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

// Area (Crestron grouping of rooms by level/zone - e.g., "1st Floor", "Master Suite", "Exterior")
export interface Area {
  id: string;
  name: string;
  roomIds: string[];   // Room IDs belonging to this area
}

// Room
export interface Room {
  id: string;
  name: string;
  areaId?: string;     // Area this room belongs to (from Crestron)
  areaName?: string;   // Area name for display
}

// Virtual Room (virtual room combining multiple physical rooms)
export interface VirtualRoom {
  id: string;               // Prefixed with "virtual-" to distinguish from real rooms
  name: string;             // User-defined name
  sourceRoomIds: string[];  // Array of real room IDs to combine
  areaId?: string;          // Area this virtual room belongs to (inherited from source rooms)
  areaName?: string;         // Area name for display
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

// Thermostat Pairing (for rooms with main thermostat + floor heat)
export interface ThermostatPair {
  roomId: string;
  roomName: string;
  mainThermostat: Thermostat;       // The thermostat with Heat/Cool/Off capability
  floorHeat: Thermostat | null;     // The "Floor Heat" thermostat (Heat/Off only)
}

// Thermostat Zone (for grouping thermostats by floor, wing, etc.)
export interface ThermostatZone {
  id: string;                       // Zone ID (e.g., "2nd-floor", "whole-house")
  name: string;                     // Display name (e.g., "2nd Floor", "Whole House")
  thermostatIds: string[];          // Array of thermostat IDs in this zone
  isBuiltIn?: boolean;              // True for auto-generated zones like "Whole House"
}

// Thermostat Zone with resolved data
export interface ThermostatZoneWithData {
  zone: ThermostatZone;
  thermostats: Thermostat[];        // Actual thermostat objects
  avgCurrentTemp: number;           // Average current temperature
  avgSetPoint: number;              // Average setpoint
  dominantMode: ThermostatMode;     // Most common mode across thermostats
  dominantFanMode: FanMode;         // Most common fan mode
  activeCount: number;              // Number of active (not off) thermostats
}

// Helper to detect if a thermostat is a floor heat unit
export function isFloorHeat(thermostat: Thermostat): boolean {
  return thermostat.name.toLowerCase().includes('floor heat');
}

// Equipment control keywords - these are "lights" in the Crestron system but are actually
// controls for equipment that should be managed separately from actual lighting
const EQUIPMENT_KEYWORDS = ['fan', 'fans', 'heater', 'pump', 'fountain', 'fire pit'];

// Helper to detect if a light is actually an equipment control
export function isEquipmentControl(light: Light): boolean {
  const lowercaseName = light.name.toLowerCase();
  
  // If name contains "light" or "lights", it's a light fixture, not equipment
  // This handles cases like "Fan Light", "Spa Light", "Pool Light"
  if (lowercaseName.includes('light')) {
    return false;
  }
  
  // Check for equipment keywords as whole words
  const words = lowercaseName.split(/[\s\-_]+/);
  return words.some(word => EQUIPMENT_KEYWORDS.includes(word));
}

// Helper to filter lights vs equipment controls
export function separateLightsAndEquipment(lights: Light[]): { actualLights: Light[]; equipment: Light[] } {
  const actualLights: Light[] = [];
  const equipment: Light[] = [];
  
  lights.forEach(light => {
    if (isEquipmentControl(light)) {
      equipment.push(light);
    } else {
      actualLights.push(light);
    }
  });
  
  return { actualLights, equipment };
}

// Helper to check if room temperature is satisfied (target reached)
export function isTemperatureSatisfied(thermostat: Thermostat): boolean {
  if (thermostat.mode === 'heat') {
    return thermostat.currentTemp >= thermostat.heatSetPoint;
  }
  if (thermostat.mode === 'cool') {
    return thermostat.currentTemp <= thermostat.coolSetPoint;
  }
  return false; // Off or auto modes don't have simple satisfaction logic
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

export interface AreasResponse {
  areas: Area[];
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

export interface VirtualRoomsResponse {
  virtualRooms: VirtualRoom[];
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

