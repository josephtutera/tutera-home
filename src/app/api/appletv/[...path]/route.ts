import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// pyatv service URL - defaults to Synology NAS on home network
// Override with PYATV_SERVICE_URL environment variable if needed
const PYATV_SERVICE_URL = process.env.PYATV_SERVICE_URL || "http://192.168.20.2:8000";

/**
 * Proxy route for Apple TV control via pyatv service
 * 
 * This route forwards requests to the local pyatv Python service.
 * The path structure mirrors the pyatv service endpoints:
 * 
 *   /api/appletv/devices                  -> GET all Apple TVs
 *   /api/appletv/devices/scan             -> POST rescan network
 *   /api/appletv/devices/{id}             -> GET device info
 *   /api/appletv/devices/{id}/remote/{cmd} -> POST remote command
 *   /api/appletv/devices/{id}/now_playing  -> GET now playing info
 *   /api/appletv/devices/{id}/apps         -> GET app list
 *   /api/appletv/devices/{id}/apps/{id}/launch -> POST launch app
 *   /api/appletv/health                    -> GET health check
 */

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string = "GET"
) {
  const path = pathSegments.join("/");
  // Forward query parameters from the original request
  const url = new URL(request.url);
  const queryString = url.searchParams.toString();
  const targetUrl = `${PYATV_SERVICE_URL}/${path}${queryString ? `?${queryString}` : ''}`;
  
  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      cache: 'no-store',
    };
    
    // Forward request body for POST/PUT requests
    if (method !== "GET" && method !== "HEAD") {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON - that's okay for some POST requests
      }
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
    
    // Return text response
    const text = await response.text();
    return new NextResponse(text, { status: response.status });
  } catch (error) {
    // Check if pyatv service is not running
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Apple TV service not available. Make sure the pyatv service is running on your Synology NAS.",
          hint: "Check http://192.168.20.2:8000/health or see docs/synology-pyatv-setup.md"
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to connect to Apple TV service" 
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, "DELETE");
}
