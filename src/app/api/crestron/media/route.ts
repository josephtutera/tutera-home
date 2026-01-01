import { NextRequest, NextResponse } from "next/server";
import { CrestronClient } from "@/lib/crestron/client";
import type { MediaRoom } from "@/lib/crestron/types";

// Force dynamic rendering - disable route caching to always get fresh device data
export const dynamic = 'force-dynamic';

// Transform Crestron media room to our interface format (same as devices route)
interface CrestronMediaRoom {
  id: number;
  name: string;
  roomId?: number;
  currentVolumeLevel: number;
  currentMuteState: "Muted" | "Unmuted" | "unmuted" | "muted";
  currentPowerState: "On" | "Off" | "on" | "off";
  currentProviderId?: number;
  currentSourceId?: number;              // Index into availableSources array
  availableProviders?: string[];         // Array of strings (old format)
  availableSources?: Array<{             // Array of objects (new format from individual room endpoint)
    id: number;
    sourceName: string;
  }>;
  availableVolumeControls: string[];    // ["discrete"] or ["none"]
  availableMuteControls: string[];      // ["discrete"] or ["none"]
}

function transformMediaRoom(m: CrestronMediaRoom) {
  const rawVolume = m.currentVolumeLevel ?? 0;
  const volumePercent = rawVolume > 100 
    ? Math.round((rawVolume / 65535) * 100) 
    : rawVolume;
  
  // Normalize power/mute state (handle lowercase variants)
  const normalizedPowerState = (m.currentPowerState || "Off").charAt(0).toUpperCase() + (m.currentPowerState || "Off").slice(1).toLowerCase() as "On" | "Off";
  const normalizedMuteState = (m.currentMuteState || "Unmuted").charAt(0).toUpperCase() + (m.currentMuteState || "Unmuted").slice(1).toLowerCase() as "Muted" | "Unmuted";
  
  // Handle both availableSources (array of objects) and availableProviders (array of strings)
  let availableProviders: string[] = [];
  let currentProviderId: number | undefined = undefined;
  let currentSourceName: string | undefined = undefined;
  
  if (m.availableSources && Array.isArray(m.availableSources) && m.availableSources.length > 0) {
    // New format: extract sourceName from each object
    availableProviders = m.availableSources.map(s => s.sourceName);
    
    // currentSourceId is the ACTUAL source ID (e.g., 53017), not an array index
    // We need to find the index by matching the ID in availableSources
    if (m.currentSourceId !== undefined) {
      const sourceIndex = m.availableSources.findIndex(s => s.id === m.currentSourceId);
      if (sourceIndex !== -1) {
        currentProviderId = sourceIndex;
        currentSourceName = m.availableSources[sourceIndex].sourceName;
      }
    }
  } else if (m.availableProviders && Array.isArray(m.availableProviders)) {
    // Old format: already an array of strings
    availableProviders = m.availableProviders;
    currentProviderId = m.currentProviderId;
    // For old format, use index directly
    if (currentProviderId !== undefined && currentProviderId >= 0 && currentProviderId < availableProviders.length) {
      currentSourceName = availableProviders[currentProviderId];
    }
  }
  
  return {
    id: String(m.id),
    name: m.name,
    type: 'mediaroom' as const,
    roomId: m.roomId ? String(m.roomId) : undefined,
    currentVolumeLevel: rawVolume,
    currentMuteState: normalizedMuteState,
    currentPowerState: normalizedPowerState,
    currentProviderId: currentProviderId,
    availableProviders: availableProviders,
    availableVolumeControls: (m.availableVolumeControls || ["none"]) as MediaRoom["availableVolumeControls"],
    availableMuteControls: (m.availableMuteControls || ["none"]) as MediaRoom["availableMuteControls"],
    isPoweredOn: normalizedPowerState === "On",
    isMuted: normalizedMuteState === "Muted",
    volumePercent,
    currentSourceName,
  };
}

function getClientConfig(request: NextRequest) {
  const processorIp = request.headers.get("x-processor-ip");
  const authKey = request.headers.get("x-auth-key");
  
  if (!processorIp || !authKey) {
    return null;
  }
  
  return { processorIp, authKey };
}

// GET - Get all media rooms or a single room by ID
export async function GET(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  const client = new CrestronClient(config);
  
  // Check if roomId query parameter is provided
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  
  if (roomId) {
    // Fetch individual media room
    const result = await client.getMediaRoom(roomId);
    
    
    if (result.success && result.data) {
      // Handle the nested structure where the API returns { mediaRooms: [...] }
      let roomData = result.data;
      
      // Check if data has a mediaRooms array (nested structure)
      if (roomData && typeof roomData === 'object' && 'mediaRooms' in roomData && Array.isArray(roomData.mediaRooms)) {
        roomData = roomData.mediaRooms[0]; // Get first room from array
      }
      
      // Transform the response to ensure consistent format
      let transformedData = roomData;
      
      // If it's a raw CrestronMediaRoom object (has number id or availableSources), transform it
      if (typeof transformedData === 'object' && transformedData !== null && 
          (typeof transformedData.id === 'number' || 'availableSources' in transformedData)) {
        transformedData = transformMediaRoom(transformedData as unknown as CrestronMediaRoom);
      }
      
      return NextResponse.json({
        success: true,
        data: transformedData,
      });
    }
    
    return NextResponse.json(result, { status: 500 });
  }
  
  // Otherwise, get all media rooms
  const result = await client.getMediaRooms();

  if (result.success) {
    return NextResponse.json(result);
  }

  return NextResponse.json(result, { status: 500 });
}

// POST - Control media room (volume, power, mute, source)
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

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing media room id" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Missing action" },
        { status: 400 }
      );
    }

    const client = new CrestronClient(config);
    let result;

    switch (action) {
      case "power": {
        const { powerState } = params;
        if (!powerState || !["on", "off"].includes(powerState)) {
          return NextResponse.json(
            { success: false, error: "Invalid power state. Must be 'on' or 'off'" },
            { status: 400 }
          );
        }
        result = await client.setMediaRoomPower(id, powerState);
        break;
      }

      case "volume": {
        const { volumePercent } = params;
        if (volumePercent === undefined || volumePercent < 0 || volumePercent > 100) {
          return NextResponse.json(
            { success: false, error: "Invalid volume. Must be 0-100" },
            { status: 400 }
          );
        }
        result = await client.setMediaRoomVolume(id, volumePercent);
        break;
      }

      case "mute": {
        const { muted } = params;
        if (typeof muted !== "boolean") {
          return NextResponse.json(
            { success: false, error: "Invalid mute value. Must be boolean" },
            { status: 400 }
          );
        }
        result = await client.setMediaRoomMute(id, muted);
        break;
      }

      case "source": {
        const { sourceIndex } = params;
        if (sourceIndex === undefined || sourceIndex < 0) {
          return NextResponse.json(
            { success: false, error: "Invalid source index" },
            { status: 400 }
          );
        }
        
        // The Crestron selectsource API expects the actual source ID, not the array index
        // Fetch the room data to get the availableSources array and look up the real ID
        const roomResult = await client.getMediaRoom(id);
        
        if (!roomResult.success || !roomResult.data) {
          return NextResponse.json(
            { success: false, error: "Failed to fetch room data for source selection" },
            { status: 500 }
          );
        }
        
        // Handle nested structure where API returns { mediaRooms: [...] }
        let roomData = roomResult.data;
        if (roomData && typeof roomData === 'object' && 'mediaRooms' in roomData && Array.isArray(roomData.mediaRooms)) {
          roomData = roomData.mediaRooms[0];
        }
        
        // Get the availableSources array which has {id, sourceName} objects
        const availableSources = (roomData as { availableSources?: Array<{id: number, sourceName: string}> }).availableSources;
        if (!availableSources || !Array.isArray(availableSources) || sourceIndex >= availableSources.length) {
          return NextResponse.json(
            { success: false, error: `Invalid source index ${sourceIndex}. Available sources: ${availableSources?.length ?? 0}` },
            { status: 400 }
          );
        }
        
        // Get the ACTUAL source ID from the array
        const actualSourceId = availableSources[sourceIndex].id;
        
        result = await client.selectMediaRoomSource(id, actualSourceId);
        break;
      }

      // Transport controls (may not be available on all systems)
      case "play": {
        result = await client.mediaRoomPlay(id);
        break;
      }

      case "pause": {
        result = await client.mediaRoomPause(id);
        break;
      }

      case "stop": {
        result = await client.mediaRoomStop(id);
        break;
      }

      case "next": {
        result = await client.mediaRoomNext(id);
        break;
      }

      case "previous": {
        result = await client.mediaRoomPrevious(id);
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid actions: power, volume, mute, source, play, pause, stop, next, previous` },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(result, { status: 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to control media room" },
      { status: 500 }
    );
  }
}
