// Crestron Home API TypeScript Interfaces

// Base types
export interface CrestronDevice {
  id: string;
  name: string;
  type: DeviceType;
  subType?: string;
  roomId?: string;
}

export type DeviceType = 
  | "light"
  | "shade"
  | "thermostat"
  | "lock"
  | "sensor"
  | "security"
  | "mediaroom"
  | "scene";

// Room
export interface Room {
  id: string;
  name: string;
}

// Merged Room (virtual room combining multiple physical rooms)
export interface MergedRoom {
  id: string;               // Prefixed with "merged-" to distinguish from real rooms
  name: string;             // User-defined name
  sourceRoomIds: string[];  // Array of real room IDs to combine
}

// Light
export interface Light extends CrestronDevice {
  type: "light";
  subType: "dimmer" | "switch";
  level: number; // 0-65535
  isOn: boolean;
}

export interface LightSetStatePayload {
  id: string;
  level?: number;
  isOn?: boolean;
}

// Shade
export interface Shade extends CrestronDevice {
  type: "shade";
  position: number; // 0-100 (0 = closed, 100 = open)
}

export interface ShadeSetPositionPayload {
  id: string;
  position: number;
}

// Scene
export interface Scene extends CrestronDevice {
  type: "scene";
  isActive?: boolean;
}

// Thermostat
export interface Thermostat extends CrestronDevice {
  type: "thermostat";
  currentTemp: number;
  heatSetPoint: number;
  coolSetPoint: number;
  mode: ThermostatMode;
  fanMode: FanMode;
  humidity?: number;
  isRunning?: boolean;
}

export type ThermostatMode = "off" | "heat" | "cool" | "auto";
export type FanMode = "auto" | "on";

export interface ThermostatSetPointPayload {
  id: string;
  heatSetPoint?: number;
  coolSetPoint?: number;
}

export interface ThermostatModePayload {
  id: string;
  mode: ThermostatMode;
}

export interface ThermostatFanModePayload {
  id: string;
  fanMode: FanMode;
}

// Door Lock
export interface DoorLock extends CrestronDevice {
  type: "lock";
  isLocked: boolean;
}

export interface DoorLockSetStatePayload {
  id: string;
  isLocked: boolean;
}

// Sensor
export interface Sensor extends CrestronDevice {
  type: "sensor";
  subType: "motion" | "contact" | "temperature" | "humidity" | "luminance";
  value: number | boolean;
  unit?: string;
}

// Security Device
export interface SecurityDevice extends CrestronDevice {
  type: "security";
  status: SecurityStatus;
}

export type SecurityStatus = "armed" | "armedAway" | "armedStay" | "disarmed" | "alarm";

// Media Room
export interface MediaRoom extends CrestronDevice {
  type: "mediaroom";
  isPoweredOn: boolean;
  currentSource?: string;
  volume?: number;
  isMuted?: boolean;
}

// Quick Action
export interface QuickAction {
  id: string;
  name: string;
  icon?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RoomsResponse {
  rooms: Room[];
}

export interface DevicesResponse {
  devices: CrestronDevice[];
}

export interface LightsResponse {
  lights: Light[];
}

export interface ShadesResponse {
  shades: Shade[];
}

export interface ScenesResponse {
  scenes: Scene[];
}

export interface ThermostatsResponse {
  thermostats: Thermostat[];
}

export interface DoorLocksResponse {
  doorLocks: DoorLock[];
}

export interface SensorsResponse {
  sensors: Sensor[];
}

export interface SecurityDevicesResponse {
  securityDevices: SecurityDevice[];
}

export interface MediaRoomsResponse {
  mediaRooms: MediaRoom[];
}

export interface QuickActionsResponse {
  quickActions: QuickAction[];
}

export interface MergedRoomsResponse {
  mergedRooms: MergedRoom[];
}

// Connection Config
export interface ConnectionConfig {
  processorIp: string;
  authToken: string;
}

export interface AuthState {
  isConnected: boolean;
  authKey?: string;
  processorIp?: string;
  error?: string;
}

