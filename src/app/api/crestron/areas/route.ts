import { NextRequest, NextResponse } from "next/server";
import { CrestronClient } from "@/lib/crestron/client";
import { promises as fs } from "fs";
import path from "path";

// Force dynamic rendering - disable route caching to always get fresh data
export const dynamic = 'force-dynamic';

const ROOM_AREAS_FILE = path.join(process.cwd(), "data", "room-areas.json");

function getClientConfig(request: NextRequest) {
  const processorIp = request.headers.get("x-processor-ip");
  const authKey = request.headers.get("x-auth-key");
  
  if (!processorIp || !authKey) {
    return null;
  }
  
  return { processorIp, authKey };
}

// Configuration-based area (for manual grouping)
interface ConfigArea {
  id: string;
  name: string;
  order: number;
  roomNames: string[];
}

interface RoomAreasConfig {
  areas: ConfigArea[];
}

// Read room areas config
async function readRoomAreasConfig(): Promise<RoomAreasConfig> {
  try {
    const data = await fs.readFile(ROOM_AREAS_FILE, "utf-8");
    return JSON.parse(data) as RoomAreasConfig;
  } catch {
    return { areas: [] };
  }
}

// Crestron room structure
interface CrestronRoom {
  id: number;
  name: string;
}

// Helper to extract rooms array from Crestron response
function extractRooms(data: unknown): CrestronRoom[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && 'rooms' in data) {
    return (data as { rooms: CrestronRoom[] }).rooms || [];
  }
  return [];
}

// Write room areas config
async function writeRoomAreasConfig(config: RoomAreasConfig): Promise<void> {
  await fs.writeFile(ROOM_AREAS_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// GET - Get all areas (room groupings by level/zone)
// Since Crestron doesn't have an /areas endpoint, we build areas from config + room data
export async function GET(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  // Fetch rooms from Crestron to get room IDs
  const client = new CrestronClient(config);
  const roomsResult = await client.getRooms();
  
  if (!roomsResult.success) {
    return NextResponse.json(roomsResult, { status: 500 });
  }
  
  const rooms = extractRooms(roomsResult.data);
  
  // Create name->id lookup (case-insensitive)
  const roomNameToId = new Map<string, string>();
  rooms.forEach(room => {
    roomNameToId.set(room.name.toLowerCase(), String(room.id));
  });
  
  // Read area configuration
  const areasConfig = await readRoomAreasConfig();
  
  // Transform config areas to include roomIds based on room names
  const areas = areasConfig.areas
    .sort((a, b) => a.order - b.order)
    .map(configArea => {
      const roomIds = configArea.roomNames
        .map(name => roomNameToId.get(name.toLowerCase()))
        .filter((id): id is string => id !== undefined);
      
      return {
        id: configArea.id,
        name: configArea.name,
        roomIds,
      };
    });
  
  return NextResponse.json({
    success: true,
    data: areas,
  });
}

// PUT - Move a room between areas
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, sourceAreaId, targetAreaId } = body;

    if (!roomName || !targetAreaId) {
      return NextResponse.json(
        { success: false, error: "roomName and targetAreaId are required" },
        { status: 400 }
      );
    }

    const areasConfig = await readRoomAreasConfig();

    // Find source area and remove the room
    if (sourceAreaId) {
      const sourceArea = areasConfig.areas.find(a => a.id === sourceAreaId);
      if (sourceArea) {
        sourceArea.roomNames = sourceArea.roomNames.filter(
          name => name.toLowerCase() !== roomName.toLowerCase()
        );
      }
    }

    // Find target area and add the room
    let targetArea = areasConfig.areas.find(a => a.id === targetAreaId);
    
    // If target area doesn't exist and it's "unassigned", don't add to any area
    if (targetAreaId === "unassigned") {
      // Just remove from source, don't add anywhere
    } else if (targetArea) {
      // Add room name if not already present
      if (!targetArea.roomNames.some(name => name.toLowerCase() === roomName.toLowerCase())) {
        targetArea.roomNames.push(roomName);
      }
    } else {
      // Create new area if it doesn't exist
      targetArea = {
        id: targetAreaId,
        name: targetAreaId.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        order: areasConfig.areas.length + 1,
        roomNames: [roomName],
      };
      areasConfig.areas.push(targetArea);
    }

    await writeRoomAreasConfig(areasConfig);

    return NextResponse.json({
      success: true,
      message: `Room "${roomName}" moved to "${targetAreaId}"`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update area" },
      { status: 500 }
    );
  }
}

// POST - Create a new area
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Area name is required" },
        { status: 400 }
      );
    }

    const areasConfig = await readRoomAreasConfig();

    // Generate ID from name
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check if area with this ID already exists
    if (areasConfig.areas.some(a => a.id === id)) {
      return NextResponse.json(
        { success: false, error: "An area with this name already exists" },
        { status: 400 }
      );
    }

    // Add new area at the end
    const newArea: ConfigArea = {
      id,
      name: name.trim(),
      order: areasConfig.areas.length + 1,
      roomNames: [],
    };

    areasConfig.areas.push(newArea);
    await writeRoomAreasConfig(areasConfig);

    return NextResponse.json({
      success: true,
      data: { id, name: name.trim(), roomIds: [] },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create area" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an area (rooms become unassigned)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("id");

    if (!areaId) {
      return NextResponse.json(
        { success: false, error: "Area ID is required" },
        { status: 400 }
      );
    }

    const areasConfig = await readRoomAreasConfig();
    const areaIndex = areasConfig.areas.findIndex(a => a.id === areaId);

    if (areaIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Area not found" },
        { status: 404 }
      );
    }

    // Remove the area
    areasConfig.areas.splice(areaIndex, 1);

    // Reorder remaining areas
    areasConfig.areas.forEach((area, index) => {
      area.order = index + 1;
    });

    await writeRoomAreasConfig(areasConfig);

    return NextResponse.json({
      success: true,
      message: `Area "${areaId}" deleted`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete area" },
      { status: 500 }
    );
  }
}

