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

// Helper to extract array from potentially nested Crestron response
function extractArray<T>(data: unknown, key: string): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && key in data) {
    return (data as Record<string, T[]>)[key] || [];
  }
  return [];
}

// Raw scene from Crestron - capture all properties
interface CrestronScene {
  id: number;
  name: string;
  roomId?: number;
  isActive?: boolean;
  // Source-related properties
  subType?: string;
  source?: string;
  deviceType?: string;
  actionType?: string;
  type?: string;
  manufacturer?: string;
  // Button number properties
  buttonNumber?: number;
  button?: number;
  buttonId?: number;
  index?: number;
  sceneIndex?: number;
  // Additional properties that may exist
  [key: string]: unknown;
}

// GET - Debug endpoint to analyze scenes
export async function GET(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  const client = new CrestronClient(config);
  
  // Fetch both scenes and rooms to show room names
  const [scenesResult, roomsResult] = await Promise.all([
    client.getScenes(),
    client.getRooms(),
  ]);

  if (scenesResult.success) {
    const allScenes = extractArray<CrestronScene>(scenesResult.data, 'scenes');
    
    // Build room lookup map
    interface CrestronRoom { id: number; name: string; [key: string]: unknown; }
    const roomsArray = roomsResult.success 
      ? extractArray<CrestronRoom>(roomsResult.data, 'rooms')
      : [];
    const roomNameMap = new Map<number, string>();
    roomsArray.forEach(room => roomNameMap.set(room.id, room.name));
    
    // Analyze scenes
    const nameCounts = new Map<string, number>();
    const nameToScenes = new Map<string, CrestronScene[]>();
    const keywordCounts = new Map<string, number>();
    
    // Common keywords to track
    const keywords = ['circadian', 'shade', 'shades', 'all on', 'all off', 'on', 'off', 
                      'bright', 'dim', 'movie', 'night', 'day', 'morning', 'evening',
                      'scene', 'vacation', 'away', 'party', 'relax', 'entertain'];
    
    allScenes.forEach(scene => {
      const name = scene.name;
      const lowerName = name.toLowerCase();
      
      // Count exact names
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      
      // Group scenes by name
      if (!nameToScenes.has(name)) {
        nameToScenes.set(name, []);
      }
      nameToScenes.get(name)!.push(scene);
      
      // Count keywords
      keywords.forEach(keyword => {
        if (lowerName.includes(keyword)) {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
      });
    });
    
    // Find duplicates (same name, different IDs)
    const duplicates: { name: string; count: number; scenes: CrestronScene[] }[] = [];
    nameToScenes.forEach((scenes, name) => {
      if (scenes.length > 1) {
        duplicates.push({ name, count: scenes.length, scenes });
      }
    });
    
    // Sort duplicates by count
    duplicates.sort((a, b) => b.count - a.count);
    
    // Sample of scene names (first 50 unique names)
    const uniqueNames = [...new Set(allScenes.map(s => s.name))].slice(0, 100);
    
    // Scenes containing specific keywords
    const circadianScenes = allScenes.filter(s => s.name.toLowerCase().includes('circadian'));
    const shadeScenes = allScenes.filter(s => s.name.toLowerCase().includes('shade'));
    
    // Detect scene source
    function detectSource(scene: CrestronScene): string {
      const propsToCheck = [
        scene.subType,
        scene.source,
        scene.deviceType,
        scene.actionType,
        scene.type,
        scene.manufacturer,
      ].filter(Boolean).map(s => String(s).toLowerCase());
      
      if (propsToCheck.some(p => p.includes('lutron'))) return 'lutron';
      if (propsToCheck.some(p => p.includes('action') || p.includes('macro'))) return 'action';
      if (propsToCheck.some(p => p.includes('crestron'))) return 'crestron';
      if (scene.subType) {
        const subTypeLower = String(scene.subType).toLowerCase();
        if (subTypeLower.includes('keypad') || subTypeLower.includes('button')) return 'lutron';
      }
      return 'unknown';
    }

    // Enrich scenes with room names and source
    const enrichedScenes = allScenes.map(scene => ({
      ...scene,
      roomName: scene.roomId ? roomNameMap.get(scene.roomId) || `Unknown Room (${scene.roomId})` : 'No Room',
      detectedSource: detectSource(scene),
    }));
    
    // Source breakdown
    const sourceBreakdown = new Map<string, number>();
    enrichedScenes.forEach(scene => {
      const source = scene.detectedSource;
      sourceBreakdown.set(source, (sourceBreakdown.get(source) || 0) + 1);
    });
    
    // Group scenes by room for analysis
    const scenesByRoom = new Map<string, typeof enrichedScenes>();
    enrichedScenes.forEach(scene => {
      const roomKey = scene.roomName;
      if (!scenesByRoom.has(roomKey)) {
        scenesByRoom.set(roomKey, []);
      }
      scenesByRoom.get(roomKey)!.push(scene);
    });
    
    // Convert to sorted array
    const roomBreakdown = Array.from(scenesByRoom.entries())
      .map(([roomName, scenes]) => ({
        roomName,
        count: scenes.length,
        sceneNames: scenes.map(s => s.name).slice(0, 10),
      }))
      .sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      success: true,
      analysis: {
        totalScenes: allScenes.length,
        uniqueSceneNames: new Set(allScenes.map(s => s.name)).size,
        duplicateNameCount: duplicates.length,
        roomCount: roomBreakdown.length,
        sourceBreakdown: Object.fromEntries(sourceBreakdown),
        keywordBreakdown: Object.fromEntries(keywordCounts),
        topDuplicates: duplicates.slice(0, 20),
        roomBreakdown: roomBreakdown.slice(0, 30),
        circadianScenes: {
          count: circadianScenes.length,
          samples: circadianScenes.slice(0, 10).map(s => s.name)
        },
        shadeScenes: {
          count: shadeScenes.length,
          samples: shadeScenes.slice(0, 10).map(s => s.name)
        },
        sampleUniqueNames: uniqueNames,
      },
      // Include raw data for first 50 scenes with room names and source
      rawSample: enrichedScenes.slice(0, 50),
      // Show all unique property keys found in scenes
      scenePropertyKeys: [...new Set(allScenes.flatMap(s => Object.keys(s)))],
      // Show unique values for type-related fields
      uniqueSubTypes: [...new Set(allScenes.map(s => s.subType).filter(Boolean))],
      uniqueTypes: [...new Set(allScenes.map(s => s.type).filter(Boolean))],
      uniqueDeviceTypes: [...new Set(allScenes.map(s => s.deviceType).filter(Boolean))],
      // Button number related fields
      buttonNumberFields: {
        hasButtonNumber: allScenes.filter(s => s.buttonNumber !== undefined).length,
        hasButton: allScenes.filter(s => s.button !== undefined).length,
        hasButtonId: allScenes.filter(s => s.buttonId !== undefined).length,
        hasIndex: allScenes.filter(s => s.index !== undefined).length,
        hasSceneIndex: allScenes.filter(s => s.sceneIndex !== undefined).length,
      },
    });
  }

  return NextResponse.json(scenesResult, { status: 500 });
}

