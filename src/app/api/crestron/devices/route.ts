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

// GET - Get all devices
export async function GET(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  const client = new CrestronClient(config);
  
  // Get all device types in parallel
  const [lights, shades, thermostats, doorLocks, sensors, securityDevices, mediaRooms] = 
    await Promise.all([
      client.getLights(),
      client.getShades(),
      client.getThermostats(),
      client.getDoorLocks(),
      client.getSensors(),
      client.getSecurityDevices(),
      client.getMediaRooms(),
    ]);

  return NextResponse.json({
    success: true,
    data: {
      lights: lights.data || [],
      shades: shades.data || [],
      thermostats: thermostats.data || [],
      doorLocks: doorLocks.data || [],
      sensors: sensors.data || [],
      securityDevices: securityDevices.data || [],
      mediaRooms: mediaRooms.data || [],
    },
  });
}

