import { NextRequest, NextResponse } from "next/server";
import { CrestronClient } from "@/lib/crestron/client";

function getClientConfig(request: NextRequest) {
  const processorIp = request.headers.get("x-processor-ip");
  const authKey = request.headers.get("x-auth-key");
  
  if (!processorIp || !authKey) {
    return null;
  }
  
  return { processorIp, authKey };
}

// GET - Get all thermostats
export async function GET(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  const client = new CrestronClient(config);
  const result = await client.getThermostats();

  if (result.success) {
    return NextResponse.json(result);
  }

  return NextResponse.json(result, { status: 500 });
}

// POST - Set thermostat settings
export async function POST(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, action, ...params } = body;
    
    // Log request for debugging
    console.log("Thermostat API request:", { id, action, params });

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "Missing thermostat id or action" },
        { status: 400 }
      );
    }

    const client = new CrestronClient(config);
    let result;

    switch (action) {
      case "setPoint":
        result = await client.setThermostatSetPoint({
          id,
          heatSetPoint: params.heatSetPoint,
          coolSetPoint: params.coolSetPoint,
        });
        break;
      case "mode":
        result = await client.setThermostatMode({ id, mode: params.mode });
        break;
      case "fanMode":
        result = await client.setThermostatFanMode({ id, fanMode: params.fanMode });
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    // Log error details for debugging
    console.error("Thermostat API error:", {
      action,
      id,
      params,
      error: result.error,
    });
    return NextResponse.json(result, { status: 500 });
  } catch (error) {
    // Log exception details for debugging
    console.error("Thermostat API exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update thermostat" },
      { status: 500 }
    );
  }
}

