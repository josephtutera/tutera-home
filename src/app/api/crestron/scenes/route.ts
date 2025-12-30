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

// Transform Crestron scene to our interface format
// Capture all properties that might indicate scene source (Lutron vs Crestron)
interface CrestronScene {
  id: number;
  name: string;
  roomId?: number;
  isActive?: boolean;
  // Properties that might indicate source
  subType?: string;
  source?: string;
  deviceType?: string;
  actionType?: string;
  type?: string;
  manufacturer?: string;
  // Button number properties (for Lutron keypads)
  buttonNumber?: number;
  button?: number;
  buttonId?: number;
  index?: number;
  sceneIndex?: number;
  // Allow additional properties
  [key: string]: unknown;
}

interface CrestronRoom {
  id: number;
  name: string;
}

// Scene source types
type SceneSource = 'lutron' | 'crestron' | 'action' | 'unknown';

// Extract button number from scene name (e.g., "Button 4" -> 4, "Keypad 515" -> 515)
function extractButtonNumberFromName(name: string): number | undefined {
  // Match patterns like "Button 4", "Button #4", "btn 4"
  const buttonMatch = name.match(/button\s*#?\s*(\d+)/i);
  if (buttonMatch) {
    return parseInt(buttonMatch[1], 10);
  }
  return undefined;
}

// Detect scene source from raw properties AND scene name
function detectSceneSource(scene: CrestronScene): SceneSource {
  const name = scene.name.toLowerCase();
  
  // Check properties first
  const propsToCheck = [
    scene.subType,
    scene.source,
    scene.deviceType,
    scene.actionType,
    scene.type,
    scene.manufacturer,
  ].filter(Boolean).map(s => String(s).toLowerCase());
  
  // Check for Lutron indicators in properties
  if (propsToCheck.some(p => p.includes('lutron'))) {
    return 'lutron';
  }
  
  // Check for Action indicators (Crestron actions/macros)
  if (propsToCheck.some(p => p.includes('action') || p.includes('macro'))) {
    return 'action';
  }
  
  // Check for explicit Crestron indicators
  if (propsToCheck.some(p => p.includes('crestron'))) {
    return 'crestron';
  }
  
  // Infer from scene name patterns
  // Keypad patterns indicate Lutron
  if (name.includes('keypad')) {
    return 'lutron';
  }
  
  // Button patterns indicate Lutron keypad buttons
  if (/button\s*#?\s*\d+/i.test(name)) {
    return 'lutron';
  }
  
  // Check subType for keypad/button
  if (scene.subType) {
    const subTypeLower = scene.subType.toLowerCase();
    if (subTypeLower.includes('keypad') || subTypeLower.includes('button')) {
      return 'lutron';
    }
  }
  
  // Common lighting scene names are typically Lutron
  const lutronKeywords = ['day', 'night', 'evening', 'morning', 'off', 'on', 'bright', 'dim', 'movie', 'relax', 'entertain', 'party', 'vacation', 'away'];
  if (lutronKeywords.some(kw => name.includes(kw))) {
    return 'lutron';
  }
  
  // A/V, Dw (down), Up patterns might be Crestron control actions
  if (/\ba\/v\b/i.test(name) || /\b(dw|up)\b/i.test(name)) {
    return 'action';
  }
  
  return 'unknown';
}

// Scene types to filter out:
// - Circadian: Lighting function for devices that are not installed/functioning
// - Shade: Shade control scenes (handled separately from lighting scenes)
const EXCLUDED_SCENE_KEYWORDS = ['circadian', 'shade'];

function shouldExcludeScene(scene: CrestronScene): boolean {
  const lowercaseName = scene.name.toLowerCase();
  return EXCLUDED_SCENE_KEYWORDS.some(keyword => lowercaseName.includes(keyword));
}

function transformScene(s: CrestronScene, roomNameMap: Map<number, string>) {
  const source = detectSceneSource(s);
  // Extract button number from properties first, then try scene name
  const buttonFromProps = s.buttonNumber ?? s.button ?? s.buttonId ?? s.index ?? s.sceneIndex;
  const buttonFromName = extractButtonNumberFromName(s.name);
  const buttonNumber = typeof buttonFromProps === 'number' ? buttonFromProps : buttonFromName;
  
  return {
    id: String(s.id),
    name: s.name,
    type: 'scene' as const,
    roomId: s.roomId ? String(s.roomId) : undefined,
    roomName: s.roomId ? roomNameMap.get(s.roomId) : undefined,
    isActive: s.isActive ?? false,
    // Source information
    source,
    subType: s.subType,
    // Button number for Lutron keypads (from props or parsed from name)
    buttonNumber,
    // Include raw type info for debugging
    rawType: s.type || s.subType || s.deviceType || s.actionType,
  };
}

// Deduplicate scenes by name (keeps first occurrence of each unique name)
function deduplicateScenes<T extends { name: string }>(scenes: T[]): T[] {
  const seen = new Set<string>();
  return scenes.filter(scene => {
    const lowerName = scene.name.toLowerCase();
    if (seen.has(lowerName)) {
      return false;
    }
    seen.add(lowerName);
    return true;
  });
}

// GET - Get all scenes
export async function GET(request: NextRequest) {
  const config = getClientConfig(request);
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing authentication headers" },
      { status: 401 }
    );
  }

  const client = new CrestronClient(config);
  
  // Fetch both scenes and rooms in parallel
  const [scenesResult, roomsResult] = await Promise.all([
    client.getScenes(),
    client.getRooms(),
  ]);

  if (scenesResult.success) {
    // Build room name lookup map
    const roomsArray = roomsResult.success 
      ? extractArray<CrestronRoom>(roomsResult.data, 'rooms')
      : [];
    const roomNameMap = new Map<number, string>();
    roomsArray.forEach(room => roomNameMap.set(room.id, room.name));
    
    // Extract, filter (exclude Circadian and Shade scenes), deduplicate, and transform scenes
    const filteredScenes = extractArray<CrestronScene>(scenesResult.data, 'scenes')
      .filter(scene => !shouldExcludeScene(scene));
    const uniqueScenes = deduplicateScenes(filteredScenes);
    const scenesArray = uniqueScenes.map(scene => transformScene(scene, roomNameMap));
    return NextResponse.json({ success: true, data: scenesArray });
  }

  return NextResponse.json(scenesResult, { status: 500 });
}

// POST - Recall/activate a scene
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing scene id" },
        { status: 400 }
      );
    }

    const client = new CrestronClient(config);
    const result = await client.recallScene(id);

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(result, { status: 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to recall scene" },
      { status: 500 }
    );
  }
}
