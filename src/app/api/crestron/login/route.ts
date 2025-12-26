import { NextRequest, NextResponse } from "next/server";
import { CrestronClient } from "@/lib/crestron/client";

// POST - Login and get auth key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processorIp, authToken } = body;

    // Use ENV variables if not provided in request
    const ipToUse = processorIp || process.env.PROCESSOR_IP;
    const tokenToUse = authToken || process.env.CRESTRON_HOME_KEY;

    if (!ipToUse || !tokenToUse) {
      return NextResponse.json(
        { success: false, error: "Missing processorIp or authToken" },
        { status: 400 }
      );
    }

    // Create client with auth token for login
    const client = new CrestronClient({
      processorIp: ipToUse,
      authToken: tokenToUse,
    });

    const result = await client.login();

    if (result.success && result.data?.authKey) {
      // Return the auth key to be stored client-side
      return NextResponse.json({
        success: true,
        authKey: result.data.authKey,
      });
    }

    return NextResponse.json(
      { success: false, error: result.error },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Login failed" },
      { status: 500 }
    );
  }
}

