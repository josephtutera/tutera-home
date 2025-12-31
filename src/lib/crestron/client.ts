// Crestron Home API Client
// This client is used server-side in API routes to communicate with the Crestron processor

import { CRESTRON_ENDPOINTS } from "./endpoints";

// Allow self-signed certificates for Crestron processors (server-side only)
if (typeof window === 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
import type {
  ApiResponse,
  Area,
  Room,
  Light,
  Shade,
  Scene,
  Thermostat,
  DoorLock,
  Sensor,
  SecurityDevice,
  MediaRoom,
  QuickAction,
  LightSetStatePayload,
  ThermostatSetPointPayload,
  ThermostatModePayload,
  ThermostatFanModePayload,
  DoorLockSetStatePayload,
} from "./types";

interface CrestronClientConfig {
  processorIp: string;
  authKey?: string;
  authToken?: string;
}

export class CrestronClient {
  private baseUrl: string;
  private authKey?: string;
  private authToken?: string;

  constructor(config: CrestronClientConfig) {
    this.baseUrl = `https://${config.processorIp}`;
    // Trim whitespace and handle any encoding issues
    this.authKey = config.authKey?.trim();
    this.authToken = config.authToken?.trim();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const method = options.method || "GET";
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      // Add cache-control headers to prevent any caching
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
    };
    
    // Only add Content-Type for requests with a body
    if (method !== "GET" && options.body) {
      headers["Content-Type"] = "application/json";
    }

    // Add auth header
    if (this.authKey) {
      headers["Crestron-RestAPI-AuthKey"] = this.authKey;
    } else if (this.authToken) {
      headers["Crestron-RestAPI-AuthToken"] = this.authToken;
    }

    try {
      // Add cache-busting timestamp to prevent Crestron processor from returning cached data
      const separator = endpoint.includes('?') ? '&' : '?';
      const cacheBustUrl = `${this.baseUrl}${endpoint}${separator}_t=${Date.now()}`;
      
      // Add timeout to prevent hanging forever on unreachable processors
      // Using 60 seconds to accommodate slow VPN connections to Crestron processors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(cacheBustUrl, {
        ...options,
        headers,
        signal: controller.signal,
        // CRITICAL: Disable Next.js fetch caching to always get fresh data from Crestron
        // Without this, device status changes made via physical devices or Crestron Home
        // iOS app will not be reflected because Next.js caches fetch responses by default
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);

      // HTTP 409 Conflict typically means the resource is already in the requested state
      // For media room controls, this is a success case (desired state already achieved)
      if (response.status === 409) {
        return { success: true, data: undefined };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      // Handle timeout/abort errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: "Connection timed out - processor may be unreachable",
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Authentication
  async login(): Promise<ApiResponse<{ authKey: string }>> {
    // API returns authkey (lowercase), we normalize to authKey
    const result = await this.request<{ authkey: string; version?: string }>(
      CRESTRON_ENDPOINTS.LOGIN,
      { method: "GET" }
    );
    
    if (result.success && result.data?.authkey) {
      this.authKey = result.data.authkey;
      return { success: true, data: { authKey: result.data.authkey } };
    }
    return { success: result.success, error: result.error, data: result.data ? { authKey: result.data.authkey } : undefined };
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.LOGOUT, { method: "POST" });
  }

  // Areas (groupings of rooms by level/zone)
  async getAreas(): Promise<ApiResponse<Area[]>> {
    return this.request<Area[]>(CRESTRON_ENDPOINTS.AREAS);
  }

  async getArea(id: string): Promise<ApiResponse<Area>> {
    return this.request<Area>(CRESTRON_ENDPOINTS.AREA(id));
  }

  // Rooms
  async getRooms(): Promise<ApiResponse<Room[]>> {
    return this.request<Room[]>(CRESTRON_ENDPOINTS.ROOMS);
  }

  async getRoom(id: string): Promise<ApiResponse<Room>> {
    return this.request<Room>(CRESTRON_ENDPOINTS.ROOM(id));
  }

  // Lights
  async getLights(): Promise<ApiResponse<Light[]>> {
    return this.request<Light[]>(CRESTRON_ENDPOINTS.LIGHTS);
  }

  async getLight(id: string): Promise<ApiResponse<Light>> {
    return this.request<Light>(CRESTRON_ENDPOINTS.LIGHT(id));
  }

  async setLightState(payload: LightSetStatePayload): Promise<ApiResponse<void>> {
    // Crestron API expects: { lights: [{ id, level, time }] }
    // Convert our payload format to Crestron format
    const level = payload.level ?? (payload.isOn ? 65535 : 0);
    const crestronPayload = {
      lights: [
        {
          id: Number(payload.id),
          level: level,
          time: 0, // Instant transition
        },
      ],
    };
    return this.request<void>(CRESTRON_ENDPOINTS.LIGHTS_SET_STATE, {
      method: "POST",
      body: JSON.stringify(crestronPayload),
    });
  }

  // Shades
  async getShades(): Promise<ApiResponse<Shade[]>> {
    return this.request<Shade[]>(CRESTRON_ENDPOINTS.SHADES);
  }

  async getShade(id: string): Promise<ApiResponse<Shade>> {
    return this.request<Shade>(CRESTRON_ENDPOINTS.SHADE(id));
  }

  // Scenes
  async getScenes(): Promise<ApiResponse<Scene[]>> {
    return this.request<Scene[]>(CRESTRON_ENDPOINTS.SCENES);
  }

  async getScene(id: string): Promise<ApiResponse<Scene>> {
    return this.request<Scene>(CRESTRON_ENDPOINTS.SCENE(id));
  }

  async recallScene(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.SCENE_RECALL(id), {
      method: "POST",
    });
  }

  // Thermostats
  async getThermostats(): Promise<ApiResponse<Thermostat[]>> {
    return this.request<Thermostat[]>(CRESTRON_ENDPOINTS.THERMOSTATS);
  }

  async getThermostat(id: string): Promise<ApiResponse<Thermostat>> {
    return this.request<Thermostat>(CRESTRON_ENDPOINTS.THERMOSTAT(id));
  }

  async setThermostatSetPoint(
    payload: ThermostatSetPointPayload
  ): Promise<ApiResponse<void>> {
    // Build setpoints array per Crestron API spec
    const setpoints: Array<{ type: string; temperature: number }> = [];
    
    if (payload.heatSetPoint !== undefined) {
      // Convert to DeciFahrenheit (e.g., 72 -> 720)
      setpoints.push({ type: "Heat", temperature: payload.heatSetPoint * 10 });
    }
    if (payload.coolSetPoint !== undefined) {
      setpoints.push({ type: "Cool", temperature: payload.coolSetPoint * 10 });
    }
    
    // Don't send request if no setpoints are provided
    if (setpoints.length === 0) {
      return {
        success: false,
        error: "At least one setpoint (heat or cool) must be provided",
      };
    }
    
    const crestronPayload = {
      id: Number(payload.id),  // Convert string ID to number
      setpoints,
    };
    
    return this.request<void>(CRESTRON_ENDPOINTS.THERMOSTAT_SET_POINT, {
      method: "POST",
      body: JSON.stringify(crestronPayload),
    });
  }

  async setThermostatMode(
    payload: ThermostatModePayload
  ): Promise<ApiResponse<void>> {
    // Convert mode to uppercase for Crestron API (e.g., "off" -> "OFF", "heat" -> "HEAT")
    // API documentation specifies: mode: "[HEAT/COOL/AUTO/OFF]"
    const uppercaseMode = payload.mode.toUpperCase();
    
    // API expects: { "thermostats": [{ "id": [id], "mode": "[HEAT/COOL/AUTO/OFF]" }] }
    const crestronPayload = {
      thermostats: [
        {
          id: Number(payload.id),  // Convert string ID to number
          mode: uppercaseMode,
        }
      ]
    };
    
    return this.request<void>(CRESTRON_ENDPOINTS.THERMOSTAT_MODE, {
      method: "POST",
      body: JSON.stringify(crestronPayload),
    });
  }

  async setThermostatFanMode(
    payload: ThermostatFanModePayload
  ): Promise<ApiResponse<void>> {
    // Capitalize fan mode for Crestron API (e.g., "auto" -> "Auto")
    const capitalizedFanMode = payload.fanMode.charAt(0).toUpperCase() + payload.fanMode.slice(1).toLowerCase();
    
    const crestronPayload = {
      id: Number(payload.id),  // Convert string ID to number
      fanMode: capitalizedFanMode,
    };
    
    return this.request<void>(CRESTRON_ENDPOINTS.THERMOSTAT_FAN_MODE, {
      method: "POST",
      body: JSON.stringify(crestronPayload),
    });
  }

  // Door Locks
  async getDoorLocks(): Promise<ApiResponse<DoorLock[]>> {
    return this.request<DoorLock[]>(CRESTRON_ENDPOINTS.DOOR_LOCKS);
  }

  async getDoorLock(id: string): Promise<ApiResponse<DoorLock>> {
    return this.request<DoorLock>(CRESTRON_ENDPOINTS.DOOR_LOCK(id));
  }

  async setDoorLockState(
    payload: DoorLockSetStatePayload
  ): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.DOOR_LOCKS, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Sensors (Read-only)
  async getSensors(): Promise<ApiResponse<Sensor[]>> {
    return this.request<Sensor[]>(CRESTRON_ENDPOINTS.SENSORS);
  }

  async getSensor(id: string): Promise<ApiResponse<Sensor>> {
    return this.request<Sensor>(CRESTRON_ENDPOINTS.SENSOR(id));
  }

  // Security Devices
  async getSecurityDevices(): Promise<ApiResponse<SecurityDevice[]>> {
    return this.request<SecurityDevice[]>(CRESTRON_ENDPOINTS.SECURITY_DEVICES);
  }

  async getSecurityDevice(id: string): Promise<ApiResponse<SecurityDevice>> {
    return this.request<SecurityDevice>(CRESTRON_ENDPOINTS.SECURITY_DEVICE(id));
  }

  // Media Rooms
  async getMediaRooms(): Promise<ApiResponse<MediaRoom[]>> {
    return this.request<MediaRoom[]>(CRESTRON_ENDPOINTS.MEDIA_ROOMS);
  }

  async getMediaRoom(id: string): Promise<ApiResponse<MediaRoom>> {
    return this.request<MediaRoom>(CRESTRON_ENDPOINTS.MEDIA_ROOM(id));
  }

  async setMediaRoomMute(id: string, muted: boolean): Promise<ApiResponse<void>> {
    const endpoint = muted 
      ? CRESTRON_ENDPOINTS.MEDIA_ROOM_MUTE(id)
      : CRESTRON_ENDPOINTS.MEDIA_ROOM_UNMUTE(id);
    return this.request<void>(endpoint, { method: "POST" });
  }

  async setMediaRoomVolume(id: string, volumePercent: number): Promise<ApiResponse<void>> {
    // Clamp volume to 0-100 range
    const clampedPercent = Math.max(0, Math.min(100, volumePercent));
    // Convert percentage (0-100) to raw Crestron volume level (0-65535)
    const rawLevel = Math.round((clampedPercent / 100) * 65535);
    return this.request<void>(CRESTRON_ENDPOINTS.MEDIA_ROOM_VOLUME(id, rawLevel), {
      method: "POST",
    });
  }

  async setMediaRoomPower(id: string, powerState: "on" | "off"): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.MEDIA_ROOM_POWER(id, powerState), {
      method: "POST",
    });
  }

  async selectMediaRoomSource(id: string, sourceIndex: number): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.MEDIA_ROOM_SELECT_SOURCE(id, sourceIndex), {
      method: "POST",
    });
  }

  // Video Rooms (may contain display/TV info)
  async getVideoRooms(): Promise<ApiResponse<unknown[]>> {
    return this.request<unknown[]>(CRESTRON_ENDPOINTS.VIDEO_ROOMS);
  }

  async getVideoRoom(id: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>(CRESTRON_ENDPOINTS.VIDEO_ROOM(id));
  }

  // Sources (may contain source type info)
  async getSources(): Promise<ApiResponse<unknown[]>> {
    return this.request<unknown[]>(CRESTRON_ENDPOINTS.SOURCES);
  }

  async getSource(id: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>(CRESTRON_ENDPOINTS.SOURCE(id));
  }

  // Quick Actions
  async getQuickActions(): Promise<ApiResponse<QuickAction[]>> {
    return this.request<QuickAction[]>(CRESTRON_ENDPOINTS.QUICK_ACTIONS);
  }

  // Utility method to update auth key
  setAuthKey(authKey: string) {
    this.authKey = authKey;
  }
}

// Singleton instance factory
let clientInstance: CrestronClient | null = null;

export function getCrestronClient(config?: CrestronClientConfig): CrestronClient {
  if (!clientInstance && config) {
    clientInstance = new CrestronClient(config);
  }
  if (!clientInstance) {
    throw new Error("Crestron client not initialized. Provide config on first call.");
  }
  return clientInstance;
}

export function resetCrestronClient() {
  clientInstance = null;
}
