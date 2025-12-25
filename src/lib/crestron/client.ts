// Crestron Home API Client
// This client is used server-side in API routes to communicate with the Crestron processor

import { CRESTRON_ENDPOINTS } from "./endpoints";

// Allow self-signed certificates for Crestron processors (server-side only)
if (typeof window === 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
import type {
  ApiResponse,
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
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
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
    return this.request<void>(CRESTRON_ENDPOINTS.LIGHTS_SET_STATE, {
      method: "POST",
      body: JSON.stringify(payload),
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
    return this.request<void>(CRESTRON_ENDPOINTS.THERMOSTAT_SET_POINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async setThermostatMode(
    payload: ThermostatModePayload
  ): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.THERMOSTAT_MODE, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async setThermostatFanMode(
    payload: ThermostatFanModePayload
  ): Promise<ApiResponse<void>> {
    return this.request<void>(CRESTRON_ENDPOINTS.THERMOSTAT_FAN_MODE, {
      method: "POST",
      body: JSON.stringify(payload),
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

