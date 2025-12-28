import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { VirtualRoom } from "@/lib/crestron/types";
import { CrestronClient } from "@/lib/crestron/client";

function getClientConfig(request: NextRequest) {
  const processorIp = request.headers.get("x-processor-ip");
  const authKey = request.headers.get("x-auth-key");
  
  if (!processorIp || !authKey) {
    return null;
  }
  
  return { processorIp, authKey };
}

// Crestron Room structure from API
interface CrestronRoom {
  id: number;
  name: string;
  areaId?: number;
  areaName?: string;
}

// Helper to extract array from potentially nested Crestron response
function extractRooms(data: unknown): CrestronRoom[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && 'rooms' in data) {
    return (data as { rooms: CrestronRoom[] }).rooms || [];
  }
  return [];
}

const DATA_FILE = path.join(process.cwd(), "data", "virtual-rooms.json");

interface VirtualRoomsData {
  virtualRooms: VirtualRoom[];
}

// Helper to read the data file
async function readData(): Promise<VirtualRoomsData> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    // If file doesn't exist, return empty array
    return { virtualRooms: [] };
  }
}

// Helper to write to the data file
async function writeData(data: VirtualRoomsData): Promise<void> {
  // Ensure the data directory exists
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET - Fetch all virtual rooms
export async function GET() {
  try {
    const data = await readData();
    return NextResponse.json({ success: true, data: data.virtualRooms });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to read virtual rooms" },
      { status: 500 }
    );
  }
}

// POST - Create a new virtual room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sourceRoomIds, areaId, areaName } = body;

    if (!name || !sourceRoomIds || !Array.isArray(sourceRoomIds) || sourceRoomIds.length < 2) {
      return NextResponse.json(
        { success: false, error: "Name and at least 2 source room IDs are required" },
        { status: 400 }
      );
    }

    const data = await readData();
    
    // Determine area assignment
    let finalAreaId = areaId;
    let finalAreaName = areaName;
    
    // If area not provided, try to find it from source rooms
    if (!finalAreaId || !finalAreaName) {
      const config = getClientConfig(request);
      if (config) {
        const client = new CrestronClient(config);
        const roomsResult = await client.getRooms();
        
        if (roomsResult.success && roomsResult.data) {
          const rooms = extractRooms(roomsResult.data);
          
          // Iterate through sourceRoomIds to find first room with area
          for (const roomId of sourceRoomIds) {
            const room = rooms.find(r => String(r.id) === roomId);
            if (room?.areaId && room?.areaName) {
              finalAreaId = String(room.areaId);
              finalAreaName = room.areaName;
              break;
            }
          }
        }
      }
    }
    
    // If still no area found, return error requiring area selection
    if (!finalAreaId || !finalAreaName) {
      return NextResponse.json(
        { success: false, error: "No area found in source rooms. Please select an area." },
        { status: 400 }
      );
    }
    
    // Generate unique ID
    const id = `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newVirtualRoom: VirtualRoom = {
      id,
      name,
      sourceRoomIds,
      areaId: finalAreaId,
      areaName: finalAreaName,
    };

    data.virtualRooms.push(newVirtualRoom);
    await writeData(data);

    return NextResponse.json({ success: true, data: newVirtualRoom });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create virtual room" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing virtual room
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, sourceRoomIds, areaId, areaName } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Virtual room ID is required" },
        { status: 400 }
      );
    }

    const data = await readData();
    const index = data.virtualRooms.findIndex((room) => room.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Virtual room not found" },
        { status: 404 }
      );
    }

    // Update fields if provided
    if (name) {
      data.virtualRooms[index].name = name;
    }
    if (sourceRoomIds && Array.isArray(sourceRoomIds) && sourceRoomIds.length >= 2) {
      data.virtualRooms[index].sourceRoomIds = sourceRoomIds;
      
      // If source rooms changed and area not explicitly provided, try to find new area
      if (!areaId || !areaName) {
        const config = getClientConfig(request);
        if (config) {
          const client = new CrestronClient(config);
          const roomsResult = await client.getRooms();
          
          if (roomsResult.success && roomsResult.data) {
            const rooms = extractRooms(roomsResult.data);
            
            // Iterate through sourceRoomIds to find first room with area
            for (const roomId of sourceRoomIds) {
              const room = rooms.find(r => String(r.id) === roomId);
              if (room?.areaId && room?.areaName) {
                data.virtualRooms[index].areaId = String(room.areaId);
                data.virtualRooms[index].areaName = room.areaName;
                break;
              }
            }
          }
        }
      }
    }
    if (areaId && areaName) {
      data.virtualRooms[index].areaId = areaId;
      data.virtualRooms[index].areaName = areaName;
    }

    await writeData(data);

    return NextResponse.json({ success: true, data: data.virtualRooms[index] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update virtual room" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a virtual room
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Virtual room ID is required" },
        { status: 400 }
      );
    }

    const data = await readData();
    const index = data.virtualRooms.findIndex((room) => room.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Virtual room not found" },
        { status: 404 }
      );
    }

    data.virtualRooms.splice(index, 1);
    await writeData(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete virtual room" },
      { status: 500 }
    );
  }
}

