import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { MergedRoom } from "@/lib/crestron/types";

const DATA_FILE = path.join(process.cwd(), "data", "merged-rooms.json");

interface MergedRoomsData {
  mergedRooms: MergedRoom[];
}

// Helper to read the data file
async function readData(): Promise<MergedRoomsData> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    // If file doesn't exist, return empty array
    return { mergedRooms: [] };
  }
}

// Helper to write to the data file
async function writeData(data: MergedRoomsData): Promise<void> {
  // Ensure the data directory exists
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET - Fetch all merged rooms
export async function GET() {
  try {
    const data = await readData();
    return NextResponse.json({ success: true, data: data.mergedRooms });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to read merged rooms" },
      { status: 500 }
    );
  }
}

// POST - Create a new merged room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sourceRoomIds } = body;

    if (!name || !sourceRoomIds || !Array.isArray(sourceRoomIds) || sourceRoomIds.length < 2) {
      return NextResponse.json(
        { success: false, error: "Name and at least 2 source room IDs are required" },
        { status: 400 }
      );
    }

    const data = await readData();
    
    // Generate unique ID
    const id = `merged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newMergedRoom: MergedRoom = {
      id,
      name,
      sourceRoomIds,
    };

    data.mergedRooms.push(newMergedRoom);
    await writeData(data);

    return NextResponse.json({ success: true, data: newMergedRoom });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create merged room" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing merged room
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, sourceRoomIds } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Merged room ID is required" },
        { status: 400 }
      );
    }

    const data = await readData();
    const index = data.mergedRooms.findIndex((room) => room.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Merged room not found" },
        { status: 404 }
      );
    }

    // Update fields if provided
    if (name) {
      data.mergedRooms[index].name = name;
    }
    if (sourceRoomIds && Array.isArray(sourceRoomIds) && sourceRoomIds.length >= 2) {
      data.mergedRooms[index].sourceRoomIds = sourceRoomIds;
    }

    await writeData(data);

    return NextResponse.json({ success: true, data: data.mergedRooms[index] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update merged room" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a merged room
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Merged room ID is required" },
        { status: 400 }
      );
    }

    const data = await readData();
    const index = data.mergedRooms.findIndex((room) => room.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Merged room not found" },
        { status: 404 }
      );
    }

    data.mergedRooms.splice(index, 1);
    await writeData(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete merged room" },
      { status: 500 }
    );
  }
}

