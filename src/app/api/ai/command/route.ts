import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { deviceFunctions, systemPrompt } from "@/lib/ai/device-functions";
import type {
  LightControlArgs,
  ClimateControlArgs,
  MediaControlArgs,
  SceneRecallArgs,
  StatusArgs,
} from "@/lib/ai/device-functions";
import {
  getMatchingLights,
  getMatchingThermostats,
  getMatchingMediaRooms,
  findScene,
  generateLightResponse,
  generateClimateResponse,
  generateMediaResponse,
  generateStatusReport,
  captureLightSnapshots,
  captureThermostatSnapshots,
  captureMediaRoomSnapshots,
} from "@/lib/ai/command-processor";
import type { DeviceStateSnapshot } from "@/lib/ai/command-processor";
import { CrestronClient } from "@/lib/crestron/client";
import type { Light, Thermostat, MediaRoom, Scene, Area, Room } from "@/lib/crestron/types";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Lazy OpenAI client initialization
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Get Crestron client config from request headers
function getClientConfig(request: NextRequest) {
  // Match the header names used by the auth store
  const authKey = request.headers.get("x-auth-key");
  const processorIp = request.headers.get("x-processor-ip");

  if (!processorIp) {
    return null;
  }

  return {
    processorIp,
    authKey: authKey || undefined,
  };
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

// Raw Crestron light format
interface RawCrestronLight {
  id: number;
  name: string;
  roomId?: number;
  level: number;
  subType?: string;
}

// Transform raw Crestron light to our Light type
function transformLight(l: RawCrestronLight): Light {
  return {
    id: String(l.id),
    name: l.name,
    type: 'light',
    subType: l.subType?.toLowerCase() === 'switch' ? 'switch' : 'dimmer',
    roomId: l.roomId ? String(l.roomId) : undefined,
    level: l.level,
    isOn: l.level > 0, // Derive isOn from level
  };
}

// Raw Crestron thermostat format
interface RawCrestronThermostat {
  id: number;
  name: string;
  roomId?: number;
  currentTemperature: number;
  temperatureUnits: string;
  currentMode: string;
  currentFanMode?: string;
  currentSetPoint: Array<{ type: string; temperature?: number }>;
}

// Transform raw Crestron thermostat to our Thermostat type
function transformThermostat(t: RawCrestronThermostat): Thermostat {
  const tempDivisor = t.temperatureUnits === 'DeciFahrenheit' ? 10 : 1;
  const currentTemp = Math.round((t.currentTemperature || 0) / tempDivisor);
  
  const heatSetPoint = t.currentSetPoint?.find(sp => sp.type === 'heat' || sp.type === 'auxHeat');
  const coolSetPoint = t.currentSetPoint?.find(sp => sp.type === 'cool');
  
  const heatSetPointTemp = heatSetPoint?.temperature ? Math.round(heatSetPoint.temperature / tempDivisor) : 68;
  const coolSetPointTemp = coolSetPoint?.temperature ? Math.round(coolSetPoint.temperature / tempDivisor) : 72;
  
  const modeMap: Record<string, "off" | "heat" | "cool" | "auto"> = {
    'Off': 'off',
    'Heat': 'heat',
    'Cool': 'cool',
    'Auto': 'auto',
    'AuxHeat': 'heat',
  };
  
  const fanModeMap: Record<string, "auto" | "on"> = {
    'Auto': 'auto',
    'On': 'on',
  };
  
  return {
    id: String(t.id),
    name: t.name,
    type: 'thermostat',
    roomId: t.roomId ? String(t.roomId) : undefined,
    currentTemp,
    heatSetPoint: heatSetPointTemp,
    coolSetPoint: coolSetPointTemp,
    mode: modeMap[t.currentMode] || 'off',
    fanMode: fanModeMap[t.currentFanMode || 'Auto'] || 'auto',
  };
}

// Fetch all current device state
async function fetchDeviceState(client: CrestronClient) {
  const [areasRes, roomsRes, lightsRes, thermostatsRes, mediaRoomsRes, scenesRes] =
    await Promise.all([
      client.getAreas(),
      client.getRooms(),
      client.getLights(),
      client.getThermostats(),
      client.getMediaRooms(),
      client.getScenes(),
    ]);

  // Extract and transform lights from raw Crestron format
  const rawLights = extractArray<RawCrestronLight>(
    lightsRes.success ? lightsRes.data : [], 
    'lights'
  );
  const lights = rawLights.map(transformLight);
  
  // Extract and transform thermostats from raw Crestron format
  const rawThermostats = extractArray<RawCrestronThermostat>(
    thermostatsRes.success ? thermostatsRes.data : [], 
    'thermostats'
  );
  const thermostats = rawThermostats.map(transformThermostat);

  return {
    areas: extractArray<Area>(areasRes.success ? areasRes.data : [], 'areas'),
    rooms: extractArray<Room>(roomsRes.success ? roomsRes.data : [], 'rooms'),
    lights,
    thermostats,
    mediaRooms: extractArray<MediaRoom>(mediaRoomsRes.success ? mediaRoomsRes.data : [], 'mediaRooms'),
    scenes: extractArray<Scene>(scenesRes.success ? scenesRes.data : [], 'scenes'),
  };
}

// Execute light control command
async function executeLightControl(
  args: LightControlArgs,
  client: CrestronClient,
  context: {
    areas: Area[];
    rooms: Room[];
    lights: Light[];
    thermostats: Thermostat[];
    mediaRooms: MediaRoom[];
    scenes: Scene[];
  },
  modifiedLightIds?: Set<string> // Track lights modified by previous calls in same request
): Promise<{
  success: boolean;
  message: string;
  snapshots: DeviceStateSnapshot[];
}> {
  const matchingLights = getMatchingLights(args, context);
  
  if (matchingLights.length === 0) {
    return {
      success: false,
      message: `No lights found${args.light_name ? ` matching "${args.light_name}"` : ""}${args.room ? ` in ${args.room}` : args.area ? ` on ${args.area}` : ""}.`,
      snapshots: [],
    };
  }

  // Capture state before changes
  const snapshots = captureLightSnapshots(matchingLights);

  // Determine which lights need to change
  let lightsToChange: Light[] = [];
  let targetLevel: number;

  // Default brightness for "on" is 75% unless specified
  const DEFAULT_ON_BRIGHTNESS = 75;
  
  switch (args.action) {
    case "on":
      targetLevel = args.brightness !== undefined 
        ? Math.round((args.brightness / 100) * 65535) 
        : Math.round((DEFAULT_ON_BRIGHTNESS / 100) * 65535);
      // If a light was just modified by a previous call (e.g., turned off), 
      // we should still turn it on regardless of its "stale" state
      lightsToChange = matchingLights.filter((l) => 
        l.level !== targetLevel || (modifiedLightIds && modifiedLightIds.has(l.id))
      );
      break;
    case "off":
      targetLevel = 0;
      // Similarly, if light was just turned on, still turn it off
      lightsToChange = matchingLights.filter((l) => 
        l.level > 0 || (modifiedLightIds && modifiedLightIds.has(l.id))
      );
      break;
    case "set_brightness":
      targetLevel = Math.round(((args.brightness || 100) / 100) * 65535);
      lightsToChange = matchingLights;
      break;
    default:
      targetLevel = Math.round((DEFAULT_ON_BRIGHTNESS / 100) * 65535);
  }

  // Execute changes
  const results = await Promise.all(
    lightsToChange.map((light) =>
      client.setLightState({ id: light.id, level: targetLevel })
    )
  );

  const successCount = results.filter((r) => r.success).length;
  const message = generateLightResponse(args, matchingLights, lightsToChange);

  return {
    success: successCount > 0 || lightsToChange.length === 0,
    message,
    snapshots,
  };
}

// Execute climate control command
async function executeClimateControl(
  args: ClimateControlArgs,
  client: CrestronClient,
  context: {
    areas: Area[];
    rooms: Room[];
    lights: Light[];
    thermostats: Thermostat[];
    mediaRooms: MediaRoom[];
    scenes: Scene[];
  }
): Promise<{
  success: boolean;
  message: string;
  snapshots: DeviceStateSnapshot[];
}> {
  const matchingThermostats = getMatchingThermostats(args, context);

  if (matchingThermostats.length === 0) {
    return {
      success: false,
      message: `No thermostats found${args.room ? ` in ${args.room}` : args.area ? ` on ${args.area}` : ""}.`,
      snapshots: [],
    };
  }

  // Capture state before changes
  const snapshots = captureThermostatSnapshots(matchingThermostats);

  // Execute changes based on action
  const results: { success: boolean }[] = [];

  for (const thermostat of matchingThermostats) {
    if (args.action === "set_temperature" && args.temperature !== undefined) {
      // Set temperature based on current mode
      const setPointPayload: { id: string; heatSetPoint?: number; coolSetPoint?: number } = {
        id: thermostat.id,
      };
      
      if (thermostat.mode === "heat") {
        setPointPayload.heatSetPoint = args.temperature;
      } else if (thermostat.mode === "cool") {
        setPointPayload.coolSetPoint = args.temperature;
      } else {
        // For auto or off, set both
        setPointPayload.heatSetPoint = args.temperature;
        setPointPayload.coolSetPoint = args.temperature;
      }
      
      const result = await client.setThermostatSetPoint(setPointPayload);
      results.push(result);
    } else if (args.action === "set_mode" && args.mode) {
      const result = await client.setThermostatMode({
        id: thermostat.id,
        mode: args.mode,
      });
      results.push(result);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const message = generateClimateResponse(args, matchingThermostats, matchingThermostats);

  return {
    success: successCount > 0,
    message,
    snapshots,
  };
}

// Execute media control command
async function executeMediaControl(
  args: MediaControlArgs,
  client: CrestronClient,
  context: {
    areas: Area[];
    rooms: Room[];
    lights: Light[];
    thermostats: Thermostat[];
    mediaRooms: MediaRoom[];
    scenes: Scene[];
  }
): Promise<{
  success: boolean;
  message: string;
  snapshots: DeviceStateSnapshot[];
}> {
  const matchingMediaRooms = getMatchingMediaRooms(args, context);

  if (matchingMediaRooms.length === 0) {
    return {
      success: false,
      message: `No media rooms found${args.room ? ` in ${args.room}` : args.area ? ` on ${args.area}` : ""}.`,
      snapshots: [],
    };
  }

  // Capture state before changes
  const snapshots = captureMediaRoomSnapshots(matchingMediaRooms);

  // Execute changes based on action
  const results: { success: boolean }[] = [];

  for (const mediaRoom of matchingMediaRooms) {
    switch (args.action) {
      case "power_on":
        results.push(await client.setMediaRoomPower(mediaRoom.id, "on"));
        break;
      case "power_off":
        results.push(await client.setMediaRoomPower(mediaRoom.id, "off"));
        break;
      case "set_volume":
        if (args.volume !== undefined) {
          results.push(await client.setMediaRoomVolume(mediaRoom.id, args.volume));
        }
        break;
      case "mute":
        results.push(await client.setMediaRoomMute(mediaRoom.id, true));
        break;
      case "unmute":
        results.push(await client.setMediaRoomMute(mediaRoom.id, false));
        break;
      case "select_source":
        if (args.source) {
          // Find the source index
          const sourceIndex = mediaRoom.availableProviders.findIndex(
            (p) => p.toLowerCase().includes(args.source!.toLowerCase())
          );
          if (sourceIndex >= 0) {
            results.push(await client.selectMediaRoomSource(mediaRoom.id, sourceIndex));
          }
        }
        break;
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const message = generateMediaResponse(args, matchingMediaRooms, matchingMediaRooms);

  return {
    success: successCount > 0,
    message,
    snapshots,
  };
}

// Execute scene recall
async function executeSceneRecall(
  args: SceneRecallArgs,
  client: CrestronClient,
  context: {
    areas: Area[];
    rooms: Room[];
    lights: Light[];
    thermostats: Thermostat[];
    mediaRooms: MediaRoom[];
    scenes: Scene[];
  }
): Promise<{
  success: boolean;
  message: string;
  snapshots: DeviceStateSnapshot[];
}> {
  const scene = findScene(args.scene_name, args.room, context);

  if (!scene) {
    return {
      success: false,
      message: `I couldn't find a scene named "${args.scene_name}".`,
      snapshots: [],
    };
  }

  // For scenes, we capture light state as scenes typically affect lights
  // In a real implementation, we'd need to know what the scene affects
  const snapshots = captureLightSnapshots(context.lights);

  const result = await client.recallScene(scene.id);

  return {
    success: result.success,
    message: result.success
      ? `Activated the "${scene.name}" scene.`
      : `Failed to activate the "${scene.name}" scene.`,
    snapshots,
  };
}

// Restore devices from snapshots (for undo)
async function restoreFromSnapshots(
  snapshots: DeviceStateSnapshot[],
  client: CrestronClient
): Promise<{ success: boolean; message: string }> {
  const results: { success: boolean }[] = [];

  for (const snapshot of snapshots) {
    switch (snapshot.type) {
      case "light": {
        const lightState = snapshot.previousState as Partial<Light>;
        if (lightState.level !== undefined) {
          results.push(
            await client.setLightState({ id: snapshot.id, level: lightState.level })
          );
        }
        break;
      }
      case "thermostat": {
        const thermoState = snapshot.previousState as Partial<Thermostat>;
        if (thermoState.mode) {
          results.push(
            await client.setThermostatMode({ id: snapshot.id, mode: thermoState.mode })
          );
        }
        if (thermoState.heatSetPoint !== undefined || thermoState.coolSetPoint !== undefined) {
          results.push(
            await client.setThermostatSetPoint({
              id: snapshot.id,
              heatSetPoint: thermoState.heatSetPoint,
              coolSetPoint: thermoState.coolSetPoint,
            })
          );
        }
        break;
      }
      case "mediaRoom": {
        const mediaState = snapshot.previousState as Partial<MediaRoom>;
        if (mediaState.isPoweredOn !== undefined) {
          results.push(
            await client.setMediaRoomPower(snapshot.id, mediaState.isPoweredOn ? "on" : "off")
          );
        }
        if (mediaState.volumePercent !== undefined) {
          results.push(await client.setMediaRoomVolume(snapshot.id, mediaState.volumePercent));
        }
        if (mediaState.isMuted !== undefined) {
          results.push(await client.setMediaRoomMute(snapshot.id, mediaState.isMuted));
        }
        break;
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const totalCount = snapshots.length;

  return {
    success: successCount > 0,
    message: `Restored ${successCount} of ${totalCount} devices to their previous state.`,
  };
}

export async function POST(request: NextRequest) {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  // Get Crestron client config
  const config = getClientConfig(request);
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Missing Crestron authentication" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { message, undoSnapshots, conversationHistory } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const client = new CrestronClient(config);

    // Handle direct undo request (from undo button, not from AI)
    if (undoSnapshots && Array.isArray(undoSnapshots) && undoSnapshots.length > 0) {
      const undoResult = await restoreFromSnapshots(undoSnapshots, client);
      return NextResponse.json({
        success: undoResult.success,
        response: undoResult.message,
        actions: [],
        wasUndo: true,
      });
    }

    // Fetch current device state
    const deviceState = await fetchDeviceState(client);
    
    // Debug: Log thermostat names
    console.log("Available thermostats:", deviceState.thermostats.map(t => ({ name: t.name, id: t.id, roomId: t.roomId, currentTemp: t.currentTemp })));

    // Build a map of lights by room for context
    const lightsByRoom = new Map<string, string[]>();
    for (const light of deviceState.lights) {
      const room = deviceState.rooms.find(r => r.id === light.roomId);
      const roomName = room?.name || "Unknown";
      if (!lightsByRoom.has(roomName)) {
        lightsByRoom.set(roomName, []);
      }
      lightsByRoom.get(roomName)!.push(light.name);
    }
    
    // Create a condensed list of lights by room (limit to avoid token overflow)
    const lightsList = Array.from(lightsByRoom.entries())
      .slice(0, 20) // Limit to 20 rooms
      .map(([roomName, lights]) => `  ${roomName}: ${lights.join(", ")}`)
      .join("\n");
    
    // Create a list of thermostats with their current state
    const thermostatsList = deviceState.thermostats
      .map(t => `  ${t.name}: ${t.currentTemp}°F, mode: ${t.mode}, heat: ${t.heatSetPoint}°F, cool: ${t.coolSetPoint}°F`)
      .join("\n");

    // Create context for status queries
    const deviceContext = `
Current state:
- ${deviceState.lights.filter((l) => l.isOn || l.level > 0).length} of ${deviceState.lights.length} lights are on
- ${deviceState.thermostats.length} thermostats (avg temp: ${Math.round(deviceState.thermostats.reduce((s, t) => s + t.currentTemp, 0) / (deviceState.thermostats.length || 1))}°F)
- ${deviceState.mediaRooms.filter((m) => m.isPoweredOn).length} of ${deviceState.mediaRooms.length} media rooms are playing
- ${deviceState.scenes.length} scenes available

Available lights by room:
${lightsList}

Available thermostats:
${thermostatsList}
`;

    // Build messages array with conversation history for context
    type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt + "\n\n" + deviceContext },
    ];
    
    // Add conversation history if provided (for multi-turn context)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    } else {
      // No history, just add current message
      messages.push({ role: "user", content: message });
    }

    // Call OpenAI with function calling
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: deviceFunctions,
      tool_choice: "auto",
    });

    const responseMessage = completion.choices[0]?.message;

    if (!responseMessage) {
      return NextResponse.json(
        { success: false, error: "No response from AI" },
        { status: 500 }
      );
    }

    // Handle tool calls (function executions)
    const actions: Array<{
      type: string;
      functionName: string;
      args: Record<string, unknown>;
      deviceSnapshots: DeviceStateSnapshot[];
    }> = [];
    
    // Accumulate messages from all tool calls
    const resultMessages: string[] = [];

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Track which light IDs have been modified so subsequent calls can account for changes
      const modifiedLightIds = new Set<string>();
      
      for (const toolCall of responseMessage.tool_calls) {
        // Type guard: only process function-type tool calls
        if (toolCall.type !== "function") continue;
        
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        let result: { success: boolean; message: string; snapshots: DeviceStateSnapshot[] } = {
          success: false,
          message: "Unknown function",
          snapshots: [],
        };

        switch (functionName) {
          case "control_lights":
            // Pass modified light IDs so subsequent calls know what changed
            result = await executeLightControl(
              args as LightControlArgs, 
              client, 
              deviceState,
              modifiedLightIds
            );
            // Track which lights were modified
            result.snapshots.forEach(s => modifiedLightIds.add(s.id));
            actions.push({
              type: "light",
              functionName,
              args,
              deviceSnapshots: result.snapshots,
            });
            break;

          case "control_climate":
            result = await executeClimateControl(args as ClimateControlArgs, client, deviceState);
            actions.push({
              type: "climate",
              functionName,
              args,
              deviceSnapshots: result.snapshots,
            });
            break;

          case "control_media":
            result = await executeMediaControl(args as MediaControlArgs, client, deviceState);
            actions.push({
              type: "media",
              functionName,
              args,
              deviceSnapshots: result.snapshots,
            });
            break;

          case "recall_scene":
            result = await executeSceneRecall(args as SceneRecallArgs, client, deviceState);
            actions.push({
              type: "scene",
              functionName,
              args,
              deviceSnapshots: result.snapshots,
            });
            break;

          case "get_status":
            const statusReport = generateStatusReport(args as StatusArgs, deviceState);
            result = { success: true, message: statusReport, snapshots: [] };
            break;

          case "undo_last_command":
            // The client will handle this by sending undoSnapshots
            result = {
              success: true,
              message: "Please use the undo button or send the previous command's snapshots to undo.",
              snapshots: [],
            };
            break;
            
          case "request_confirmation":
            // AI is requesting confirmation before a large action
            const confirmArgs = args as { 
              action_description: string; 
              device_count: number; 
              alternative_suggestion?: string;
            };
            let confirmMessage = `⚠️ This would ${confirmArgs.action_description} (${confirmArgs.device_count} devices). `;
            if (confirmArgs.alternative_suggestion) {
              confirmMessage += confirmArgs.alternative_suggestion + " ";
            }
            confirmMessage += "Reply 'yes' to proceed or specify what you meant.";
            
            return NextResponse.json({
              success: true,
              response: confirmMessage,
              actions: [],
              wasUndo: false,
              needsConfirmation: true,
            });

          case "start_new_conversation":
            // Signal to the client to clear conversation
            result = {
              success: true,
              message: "Started a fresh conversation. How can I help you?",
              snapshots: [],
            };
            // Add a flag to the response to tell client to clear conversation
            return NextResponse.json({
              success: true,
              response: result.message,
              actions: [],
              wasUndo: false,
              clearConversation: true,
            });
        }

        // Accumulate result messages
        if (result.message) {
          resultMessages.push(result.message);
        }
      }
    }

    // Extract suggestions from tool calls if provided
    let suggestions: string[] = [];
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type === "function" && toolCall.function.name === "provide_suggestions") {
          try {
            const suggestionsArgs = JSON.parse(toolCall.function.arguments);
            if (suggestionsArgs.suggestions && Array.isArray(suggestionsArgs.suggestions)) {
              suggestions = suggestionsArgs.suggestions.slice(0, 5);
            }
          } catch (e) {
            console.error("Failed to parse suggestions:", e);
          }
        }
      }
    }

    // Combine all messages or use AI's text response
    const finalResponse = resultMessages.length > 0 
      ? resultMessages.join(" ") 
      : (responseMessage.content || "Command processed.");

    return NextResponse.json({
      success: true,
      response: finalResponse,
      actions,
      wasUndo: false,
      suggestions, // Include dynamic suggestions for the UI
    });
  } catch (error) {
    console.error("AI command error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process command",
      },
      { status: 500 }
    );
  }
}
