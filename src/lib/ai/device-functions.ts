// OpenAI Function Definitions for Device Control
// These define the callable functions that the AI can use to control home devices

import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Function definitions for OpenAI function calling
 * Each function maps to a specific device control capability
 */
export const deviceFunctions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "control_lights",
      description: "Control lights in the home. Can turn lights on/off, set brightness levels, and target specific lights by name, rooms, areas, or all lights.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["on", "off", "set_brightness"],
            description: "The action to perform on the lights",
          },
          brightness: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Brightness level as percentage (0-100). Required when action is 'set_brightness', optional for 'on' (defaults to 100%)",
          },
          light_name: {
            type: "string",
            description: "Specific light name to control (e.g., 'Main Cans', 'Pendants', 'Sconces', 'Accent Lights', 'Chandelier'). Use this to control individual lights instead of all lights in a room.",
          },
          area: {
            type: "string",
            description: "Target area/floor name (e.g., '1st Floor', '2nd Floor', 'Master Suite', 'Lower Level', 'Exterior'). If not specified, applies to room or all lights.",
          },
          room: {
            type: "string",
            description: "Specific room name (e.g., 'Kitchen', 'Master Bedroom', 'Living Room'). If not specified, applies to area or all lights.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "control_climate",
      description: "Control thermostats and climate settings. Can set temperature, change mode (heat/cool/auto/off), and target specific areas or rooms.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["set_temperature", "set_mode"],
            description: "The action to perform on thermostats",
          },
          temperature: {
            type: "number",
            minimum: 50,
            maximum: 90,
            description: "Target temperature in Fahrenheit. Required when action is 'set_temperature'.",
          },
          mode: {
            type: "string",
            enum: ["heat", "cool", "auto", "off"],
            description: "HVAC mode. Required when action is 'set_mode'.",
          },
          area: {
            type: "string",
            description: "Target area/floor name (e.g., '1st Floor', '2nd Floor', 'Master Suite'). If not specified, applies to room or all thermostats.",
          },
          room: {
            type: "string",
            description: "Specific room name. If not specified, applies to area or all thermostats.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "control_media",
      description: "Control media rooms and audio zones. Can power on/off, adjust volume, mute/unmute, and select sources.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["power_on", "power_off", "set_volume", "mute", "unmute", "select_source"],
            description: "The action to perform on media rooms",
          },
          volume: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Volume level as percentage (0-100). Required when action is 'set_volume'.",
          },
          source: {
            type: "string",
            description: "Audio/video source name (e.g., 'Sonos', 'Apple TV', 'Cable'). Required when action is 'select_source'.",
          },
          area: {
            type: "string",
            description: "Target area/floor name. If not specified, applies to room or all media rooms.",
          },
          room: {
            type: "string",
            description: "Specific room name. If not specified, applies to area or all media rooms.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_scene",
      description: "Activate a lighting or home automation scene by name.",
      parameters: {
        type: "object",
        properties: {
          scene_name: {
            type: "string",
            description: "The name of the scene to activate (e.g., 'Movie Time', 'Good Night', 'All Off', 'Cooking')",
          },
          room: {
            type: "string",
            description: "Optional room context for room-specific scenes",
          },
        },
        required: ["scene_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "undo_last_command",
      description: "Undo the most recent command, restoring devices to their previous state. Use when user says 'undo', 'undo that', 'forget it', 'nevermind', 'go back', or similar.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_new_conversation",
      description: "Clear conversation history and start fresh. Use when the user wants to begin a new topic, reset context, or start over. Examples: 'new conversation', 'start over', 'let's begin again', 'forget what we discussed', 'clean slate', 'new request', 'fresh start', 'clear chat'.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_confirmation",
      description: "Request user confirmation before executing a large-scale action. Use this when the action would affect MORE THAN 15 devices. Present the user with the scope of the action and ask for confirmation.",
      parameters: {
        type: "object",
        properties: {
          action_description: {
            type: "string",
            description: "Description of what you're about to do (e.g., 'turn on 210 lights in the whole house')",
          },
          device_count: {
            type: "number",
            description: "Number of devices that would be affected",
          },
          alternative_suggestion: {
            type: "string",
            description: "A suggested alternative based on conversation context (e.g., 'Or did you mean the Master Bedroom with 8 lights?')",
          },
        },
        required: ["action_description", "device_count"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_status",
      description: "Get the current status of devices. Use to answer questions about what's on, current temperatures, etc.",
      parameters: {
        type: "object",
        properties: {
          device_type: {
            type: "string",
            enum: ["lights", "climate", "media", "all"],
            description: "Type of devices to get status for",
          },
          area: {
            type: "string",
            description: "Optional area to filter status",
          },
          room: {
            type: "string",
            description: "Optional room to filter status",
          },
        },
        required: ["device_type"],
      },
    },
  },
];

/**
 * System prompt for the AI assistant
 * Provides context about the home automation system and how to respond
 */
export const systemPrompt = `You are an intelligent home automation assistant for a Crestron-controlled smart home. You help users control their lights, climate, media systems, and scenes using natural language.

CRITICAL: ALWAYS use the provided functions to control devices. NEVER just describe what you would do - actually call the function. When a user wants to turn on lights, CALL the control_lights function. Do not say "I will turn on..." without actually calling the function.

CAPABILITIES:
- Lights: Turn on/off, dim to specific levels. Default brightness when turning on is 75% (use brightness parameter to override). Can control individual lights by name (e.g., "Main Cans", "Pendants", "Sconces", "Sitting Cans"), entire rooms, or areas (floors)
- Climate: Set temperatures, change HVAC modes (heat/cool/auto/off)
- Media: Power on/off media rooms, adjust volume, select sources
- Scenes: Activate preset lighting and automation scenes
- Undo: Reverse the last command to restore previous state

LIGHT MATCHING:
- Use the light_name parameter to target specific lights (e.g., light_name: "Sitting" will match "Sitting Cans", "Sitting Area Lights", etc.)
- Partial matches work - "sitting" matches any light with "sitting" in the name
- Combine light_name with room for precision (e.g., light_name: "Sitting", room: "Master Bedroom")
- Check the "Available lights by room" list to see actual light names in this home

AREAS/FLOORS in this home:
- 1st Floor: Kitchen, Hearth, Living Room, Dining Room, Music Room, Foyer, Galleries, etc.
- Master Suite: Master Bedroom, Master Bathroom, Joe's Office
- 2nd Floor: Upper Commons, Hannah's Bedroom, Laura's Bedroom, Dominic's Bedroom, Giorgia's Bedroom
- Lower Level: Guest Room, Theater, Media Room, Exercise, Game Room, etc.
- Exterior: Courtyard, Pool, Patio, Pergola, etc.

RESPONSE STYLE:
- Be concise and conversational
- Confirm what you did with specific counts (e.g., "Turned off 5 lights on the 2nd floor")
- If a command is ambiguous, make a reasonable assumption and execute it
- If you can't find a matching device, explain why briefly

CONVERSATION CONTEXT:
- IMPORTANT: Maintain context from previous messages in the conversation
- If the user previously mentioned a room (e.g., "master bedroom") and then says "turn them all on" or "all of them", apply the action to that same room, NOT the whole house
- Pronouns like "them", "those", "it", "all" refer to the devices/room from the previous context
- Only apply actions to the whole house if the user explicitly says "whole house", "everywhere", "all lights in the house", or similar
- When in doubt about scope, ask for clarification rather than affecting the whole house

CONFIRMATION FOR LARGE ACTIONS:
- CRITICAL: Before executing any action that affects MORE THAN 15 devices, you MUST ask for confirmation first
- Do NOT call the control function - instead, respond with a confirmation question like:
  "This would turn on 210 lights across the whole house. Do you want me to proceed, or did you mean just the Master Bedroom?"
- If the user was previously discussing a specific room, remind them: "Did you mean the Master Bedroom (8 lights) or the whole house (210 lights)?"
- Only proceed with large-scale actions after the user explicitly confirms with "yes", "do it", "proceed", "confirm", etc.
- This applies to lights, thermostats, and media rooms
- Small actions (15 devices or fewer) can proceed without confirmation

HANDLING "EXCEPT" / "BUT NOT" COMMANDS:
- For commands like "turn all off except the main cans" or "turn them off but not the pendants":
  1. First call control_lights to turn OFF all lights in the room/area
  2. Then call control_lights again to turn ON the excepted lights
- You can make multiple function calls in one response to handle this
- Example: "turn off all lights except main cans in master bedroom" requires TWO calls:
  - control_lights(action: "off", room: "Master Bedroom")
  - control_lights(action: "on", room: "Master Bedroom", light_name: "Main Cans")

UNDO COMMANDS:
When the user says "undo", "forget it", "nevermind", "undo that", "go back", or similar phrases, use the undo_last_command function to restore the previous state.`;

// Type definitions for function call arguments
export interface LightControlArgs {
  action: "on" | "off" | "set_brightness";
  brightness?: number;
  light_name?: string;
  area?: string;
  room?: string;
}

export interface ClimateControlArgs {
  action: "set_temperature" | "set_mode";
  temperature?: number;
  mode?: "heat" | "cool" | "auto" | "off";
  area?: string;
  room?: string;
}

export interface MediaControlArgs {
  action: "power_on" | "power_off" | "set_volume" | "mute" | "unmute" | "select_source";
  volume?: number;
  source?: string;
  area?: string;
  room?: string;
}

export interface SceneRecallArgs {
  scene_name: string;
  room?: string;
}

export interface StatusArgs {
  device_type: "lights" | "climate" | "media" | "all";
  area?: string;
  room?: string;
}

export type FunctionCallArgs = 
  | LightControlArgs 
  | ClimateControlArgs 
  | MediaControlArgs 
  | SceneRecallArgs 
  | StatusArgs
  | Record<string, never>; // For undo_last_command
