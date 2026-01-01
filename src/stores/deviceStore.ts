"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Area,
  Room,
  VirtualRoom,
  Light,
  Shade,
  Scene,
  Thermostat,
  DoorLock,
  Sensor,
  SecurityDevice,
  MediaRoom,
  QuickAction,
  ThermostatPair,
  ThermostatMode,
  ThermostatZone,
  ThermostatZoneWithData,
  FanMode,
  AudioZone,
} from "@/lib/crestron/types";
import { isFloorHeat, isTemperatureSatisfied, isEquipmentControl, separateLightsAndEquipment } from "@/lib/crestron/types";
import { useAuthStore, refreshAuth } from "./authStore";

// Helper for shallow comparison of arrays of objects by comparing JSON representations
// This prevents unnecessary React re-renders when polled data hasn't changed
function hasArrayChanged<T>(oldArray: T[], newArray: T[]): boolean {
  if (oldArray.length !== newArray.length) return true;
  // Compare serialized versions for deep equality check
  return JSON.stringify(oldArray) !== JSON.stringify(newArray);
}

interface DeviceState {
  // Data
  areas: Area[];
  rooms: Room[];
  virtualRooms: VirtualRoom[];
  lights: Light[];
  shades: Shade[];
  scenes: Scene[];
  thermostats: Thermostat[];
  thermostatZones: ThermostatZone[];
  doorLocks: DoorLock[];
  sensors: Sensor[];
  securityDevices: SecurityDevice[];
  mediaRooms: MediaRoom[];
  quickActions: QuickAction[];
  audioZones: AudioZone[];  // User-defined audio zones
  
  // Favorite scenes (persisted locally)
  favoriteSceneIds: string[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  setAreas: (areas: Area[]) => void;
  setRooms: (rooms: Room[]) => void;
  setVirtualRooms: (virtualRooms: VirtualRoom[]) => void;
  setLights: (lights: Light[]) => void;
  setShades: (shades: Shade[]) => void;
  setScenes: (scenes: Scene[]) => void;
  setThermostats: (thermostats: Thermostat[]) => void;
  setThermostatZones: (zones: ThermostatZone[]) => void;
  setDoorLocks: (doorLocks: DoorLock[]) => void;
  setSensors: (sensors: Sensor[]) => void;
  setSecurityDevices: (securityDevices: SecurityDevice[]) => void;
  setMediaRooms: (mediaRooms: MediaRoom[]) => void;
  setQuickActions: (quickActions: QuickAction[]) => void;
  setAudioZones: (audioZones: AudioZone[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdated: (date: Date) => void;
  
  // Favorite scene actions
  toggleFavoriteScene: (sceneId: string) => void;
  
  // Optimistic update helpers
  updateLight: (id: string, updates: Partial<Light>) => void;
  updateThermostat: (id: string, updates: Partial<Thermostat>) => void;
  updateDoorLock: (id: string, updates: Partial<DoorLock>) => void;
  updateMediaRoom: (id: string, updates: Partial<MediaRoom>) => void;
  
  // Clear all data
  clearAll: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      areas: [],
      rooms: [],
      virtualRooms: [],
      lights: [],
      shades: [],
      scenes: [],
      thermostats: [],
      thermostatZones: [],
      doorLocks: [],
      sensors: [],
      securityDevices: [],
      mediaRooms: [],
      quickActions: [],
      audioZones: [],
      favoriteSceneIds: [],
      isLoading: false,
      error: null,
      lastUpdated: null,

      setAreas: (areas) => set({ areas }),
      setRooms: (rooms) => set({ rooms }),
      setVirtualRooms: (virtualRooms) => set({ virtualRooms }),
      setLights: (lights) => set({ lights }),
      setShades: (shades) => set({ shades }),
      setScenes: (scenes) => set({ scenes }),
      setThermostats: (thermostats) => set((state) => {
        // Preserve setpoints when Crestron doesn't provide them (e.g., when mode is Off)
        // If new heatSetPoint equals currentTemp and mode is "off", it likely means
        // Crestron didn't provide setpoint data, so we preserve the existing setpoint
        const mergedThermostats = thermostats.map((newThermo) => {
          const existingThermo = state.thermostats.find((t) => t.id === newThermo.id);
          
          // If no existing thermostat, use the new one as-is
          if (!existingThermo) {
            return newThermo;
          }
          
          // If mode is "off" and heatSetPoint equals currentTemp (likely defaulted by transform),
          // preserve existing setpoints to maintain the last set target temperature
          // Only preserve if existing setpoint is different from the new currentTemp (indicating it was actually set)
          if (
            newThermo.mode === "off" && 
            newThermo.heatSetPoint === newThermo.currentTemp &&
            existingThermo.heatSetPoint !== newThermo.currentTemp
          ) {
            return {
              ...newThermo,
              heatSetPoint: existingThermo.heatSetPoint,
              coolSetPoint: existingThermo.coolSetPoint,
            };
          }
          
          // Otherwise use the new data (setpoints were provided by Crestron or match current temp)
          return newThermo;
        });
        
        return { thermostats: mergedThermostats };
      }),
      setThermostatZones: (thermostatZones) => set({ thermostatZones }),
      setDoorLocks: (doorLocks) => set({ doorLocks }),
      setSensors: (sensors) => set({ sensors }),
      setSecurityDevices: (securityDevices) => set({ securityDevices }),
      setMediaRooms: (mediaRooms) => set({ mediaRooms }),
      setQuickActions: (quickActions) => set({ quickActions }),
      setAudioZones: (audioZones) => set({ audioZones }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setLastUpdated: (date) => set({ lastUpdated: date }),

      toggleFavoriteScene: (sceneId) =>
        set((state) => ({
          favoriteSceneIds: state.favoriteSceneIds.includes(sceneId)
            ? state.favoriteSceneIds.filter((id) => id !== sceneId)
            : [...state.favoriteSceneIds, sceneId],
        })),

      updateLight: (id, updates) =>
        set((state) => ({
          lights: state.lights.map((light) =>
            light.id === id ? { ...light, ...updates } : light
          ),
        })),

      updateThermostat: (id, updates) =>
        set((state) => ({
          thermostats: state.thermostats.map((thermostat) =>
            thermostat.id === id ? { ...thermostat, ...updates } : thermostat
          ),
        })),

      updateDoorLock: (id, updates) =>
        set((state) => ({
          doorLocks: state.doorLocks.map((lock) =>
            lock.id === id ? { ...lock, ...updates } : lock
          ),
        })),

      updateMediaRoom: (id, updates) =>
        set((state) => ({
          mediaRooms: state.mediaRooms.map((mediaRoom) =>
            mediaRoom.id === id ? { ...mediaRoom, ...updates } : mediaRoom
          ),
        })),

      clearAll: () =>
        set({
          areas: [],
          rooms: [],
          virtualRooms: [],
          lights: [],
          shades: [],
          scenes: [],
          thermostats: [],
          thermostatZones: [],
          doorLocks: [],
          sensors: [],
          securityDevices: [],
          mediaRooms: [],
          quickActions: [],
          audioZones: [],
          favoriteSceneIds: [],
          isLoading: false,
          error: null,
          lastUpdated: null,
        }),
    }),
    {
      name: "crestron-devices",
      // Persist all device data so it's available immediately on page load
      partialize: (state) => ({
        areas: state.areas,
        rooms: state.rooms,
        virtualRooms: state.virtualRooms,
        lights: state.lights,
        shades: state.shades,
        scenes: state.scenes,
        thermostats: state.thermostats,
        thermostatZones: state.thermostatZones,
        doorLocks: state.doorLocks,
        sensors: state.sensors,
        securityDevices: state.securityDevices,
        mediaRooms: state.mediaRooms,
        quickActions: state.quickActions,
        audioZones: state.audioZones,
        favoriteSceneIds: state.favoriteSceneIds,
        lastUpdated: state.lastUpdated,
        // Don't persist isLoading or error - these should be transient
      }),
    }
  )
);

// Fetch helpers
async function fetchWithAuth(endpoint: string) {
  const headers = useAuthStore.getState().getAuthHeaders();
  // CRITICAL: Use cache: 'no-store' to prevent browser caching
  // This ensures we always get fresh data from the Crestron processor
  const response = await fetch(`/api/crestron/${endpoint}`, { 
    headers,
    cache: 'no-store',
  });
  return response.json();
}

// Track if we're already attempting to refresh auth to prevent loops
let isRefreshingAuth = false;

// Fetch all data (rooms, devices, scenes) - used by DataProvider for polling
// silent: if true, don't set isLoading to true (used for background polling to avoid UI flicker)
export async function fetchAllData(isRetryAfterRefresh = false, silent = false) {
  const store = useDeviceStore.getState();
  
  // Skip if already loading to prevent overlap
  if (store.isLoading) {
    return;
  }
  
  // Only set loading state for non-silent fetches (manual refresh, initial load)
  // Silent fetches are used for background polling to avoid UI flicker
  if (!silent) {
    store.setLoading(true);
  }
  store.setError(null);
  
  try {
    // Fetch all data in parallel (including areas, virtual rooms, and audio zones from server)
    const [areasData, roomsData, devicesData, scenesData, virtualRoomsData, audioZonesData] = await Promise.all([
      fetchWithAuth("areas"),
      fetchWithAuth("rooms"),
      fetchWithAuth("devices"),
      fetchWithAuth("scenes"),
      fetch("/api/crestron/virtual-rooms", { cache: 'no-store' }).then(res => res.json()),
      fetch("/api/crestron/audio-zones", { cache: 'no-store' }).then(res => res.json()),
    ]);
    
    // Check if all responses indicate potential auth failure (empty data or errors)
    const areasArray = areasData.success 
      ? (Array.isArray(areasData.data) ? areasData.data : areasData.data?.areas || [])
      : [];
    const roomsArray = roomsData.success 
      ? (Array.isArray(roomsData.data) ? roomsData.data : roomsData.data?.rooms || [])
      : [];
    const lightsArray = devicesData.success && devicesData.data?.lights || [];
    const scenesArray = scenesData.success ? (Array.isArray(scenesData.data) ? scenesData.data : []) : [];
    
    // Detect auth failure: if we get empty data from ALL endpoints, auth likely expired
    const allEmpty = areasArray.length === 0 && roomsArray.length === 0 && lightsArray.length === 0 && scenesArray.length === 0;
    
    // If all data is empty and we haven't already tried refreshing, attempt to refresh auth
    if (allEmpty && !isRetryAfterRefresh && !isRefreshingAuth) {
      isRefreshingAuth = true;
      if (!silent) {
        store.setLoading(false); // Release loading lock for refresh
      }
      
      const refreshSuccess = await refreshAuth();
      isRefreshingAuth = false;
      
      if (refreshSuccess) {
        // Retry fetch with new auth, preserving silent flag
        return fetchAllData(true, silent);
      } else {
        store.setError("Session expired. Please log in again.");
        return;
      }
    }
    
    // Process areas and rooms together - Crestron areas may include rooms, or rooms may have areaId
    interface TransformedArea {
      id: string;
      name: string;
      roomIds: string[];
    }
    
    interface TransformedRoom {
      id: string;
      name: string;
      areaId?: string;
      areaName?: string;
    }
    
    // First, check if areas from API have roomIds populated
    let areas: TransformedArea[] = [];
    if (areasData.success && areasArray.length > 0) {
      areas = areasArray as TransformedArea[];
    }
    
    // Check if areas have roomIds populated (some Crestron versions include this)
    const areasHaveRoomIds = areas.some(a => a.roomIds && a.roomIds.length > 0);
    
    // Build area name lookup from areas API
    const areaIdToName = new Map<string, string>();
    areas.forEach(area => {
      areaIdToName.set(area.id, area.name);
    });
    
    // Process rooms and potentially enrich with area info
    let transformedRooms: TransformedRoom[] = [];
    if (roomsData.success && roomsArray.length > 0) {
      transformedRooms = roomsArray.map((room: { id: string; name: string; areaId?: string; areaName?: string }) => {
        const roomId = String(room.id);
        // Room might already have areaId and areaName from API transform
        const areaId = room.areaId;
        const areaName = room.areaName || (areaId ? areaIdToName.get(areaId) : undefined);
        
        return {
          id: roomId,
          name: room.name,
          areaId,
          areaName,
        };
      });
      // Always update rooms - they contain areaId mappings critical for zone filtering
      store.setRooms(transformedRooms);
    }
    
    // If areas don't have roomIds from API, build them from room data
    if (!areasHaveRoomIds && transformedRooms.length > 0) {
      // Build areas from room's areaId/areaName
      const areaMap = new Map<string, { id: string; name: string; roomIds: string[] }>();
      
      transformedRooms.forEach(room => {
        if (room.areaId && room.areaName) {
          if (!areaMap.has(room.areaId)) {
            areaMap.set(room.areaId, {
              id: room.areaId,
              name: room.areaName,
              roomIds: [],
            });
          }
          areaMap.get(room.areaId)!.roomIds.push(room.id);
        }
      });
      
      // Convert to array and merge with existing areas (to preserve any areas without rooms)
      const areasFromRooms = Array.from(areaMap.values());
      
      // If we have areas from the API, merge; otherwise use what we built from rooms
      if (areas.length > 0) {
        // Update existing areas with roomIds
        areas = areas.map(area => {
          const fromRooms = areasFromRooms.find(a => a.id === area.id);
          return fromRooms ? { ...area, roomIds: fromRooms.roomIds } : area;
        });
      } else {
        areas = areasFromRooms;
      }
    }
    
    // Always update areas - they contain critical roomId mappings for zone filtering
    // Don't use change detection here as stale area data breaks zone assignment
    if (areas.length > 0) {
      store.setAreas(areas);
    }
    
    // Process devices - only update if data changed (prevents unnecessary React re-renders)
    // This is important for fast polling (3s) to avoid UI flickering
    if (devicesData.success && devicesData.data) {
      // Only update each device type if we got non-empty data AND it has changed
      if (devicesData.data.lights?.length > 0 && hasArrayChanged(store.lights, devicesData.data.lights)) {
        store.setLights(devicesData.data.lights);
      }
      if (devicesData.data.shades?.length > 0 && hasArrayChanged(store.shades, devicesData.data.shades)) {
        store.setShades(devicesData.data.shades);
      }
      if (devicesData.data.thermostats?.length > 0 && hasArrayChanged(store.thermostats, devicesData.data.thermostats)) {
        store.setThermostats(devicesData.data.thermostats);
      }
      if (devicesData.data.doorLocks?.length > 0 && hasArrayChanged(store.doorLocks, devicesData.data.doorLocks)) {
        store.setDoorLocks(devicesData.data.doorLocks);
      }
      if (devicesData.data.sensors?.length > 0 && hasArrayChanged(store.sensors, devicesData.data.sensors)) {
        store.setSensors(devicesData.data.sensors);
      }
      if (devicesData.data.securityDevices?.length > 0 && hasArrayChanged(store.securityDevices, devicesData.data.securityDevices)) {
        store.setSecurityDevices(devicesData.data.securityDevices);
      }
      if (devicesData.data.mediaRooms?.length > 0 && hasArrayChanged(store.mediaRooms, devicesData.data.mediaRooms)) {
        store.setMediaRooms(devicesData.data.mediaRooms);
      }
    }
    
    // Process scenes - only update if data changed
    if (scenesData.success && scenesArray.length > 0 && hasArrayChanged(store.scenes, scenesArray)) {
      store.setScenes(scenesArray);
    }
    
    // Process virtual rooms from server - only update if changed
    if (virtualRoomsData.success && Array.isArray(virtualRoomsData.data) && hasArrayChanged(store.virtualRooms, virtualRoomsData.data)) {
      store.setVirtualRooms(virtualRoomsData.data);
    }
    
    // Process audio zones from server - only update if changed
    if (audioZonesData.success && Array.isArray(audioZonesData.data) && hasArrayChanged(store.audioZones, audioZonesData.data)) {
      store.setAudioZones(audioZonesData.data);
    }
    
    // Always update timestamp so users know polling is working
    store.setLastUpdated(new Date());
    
    // Check for any errors
    const errors = [
      !roomsData.success && roomsData.error,
      !devicesData.success && devicesData.error,
      !scenesData.success && scenesData.error,
    ].filter(Boolean);
    
    if (errors.length > 0) {
      store.setError(errors.join("; "));
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : "Failed to fetch data");
  } finally {
    // Only reset loading state if we set it (non-silent calls)
    if (!silent) {
      store.setLoading(false);
    }
  }
}

// Fetch all rooms
export async function fetchRooms() {
  const { setRooms, setError } = useDeviceStore.getState();
  try {
    const data = await fetchWithAuth("rooms");
    if (data.success) {
      const roomsArray = Array.isArray(data.data) ? data.data : data.data?.rooms || [];
      // Transform room IDs to strings to match how device roomId fields are stored
      const transformedRooms = roomsArray.map((room: { id: string | number; name: string }) => ({
        ...room,
        id: String(room.id),
      }));
      setRooms(transformedRooms);
    } else {
      setError(data.error);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch rooms");
  }
}

// Fetch all devices
export async function fetchAllDevices() {
  const { setLoading, setError, setLights, setShades, setThermostats, setDoorLocks, setSensors, setSecurityDevices, setMediaRooms, setLastUpdated } = useDeviceStore.getState();
  
  setLoading(true);
  try {
    const data = await fetchWithAuth("devices");
    if (data.success && data.data) {
      setLights(data.data.lights || []);
      setShades(data.data.shades || []);
      setThermostats(data.data.thermostats || []);
      setDoorLocks(data.data.doorLocks || []);
      setSensors(data.data.sensors || []);
      setSecurityDevices(data.data.securityDevices || []);
      setMediaRooms(data.data.mediaRooms || []);
      setLastUpdated(new Date());
    } else {
      setError(data.error);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch devices");
  } finally {
    setLoading(false);
  }
}

// Fetch media rooms only
export async function fetchMediaRooms() {
  const { setMediaRooms, setError } = useDeviceStore.getState();
  try {
    const data = await fetchWithAuth("devices");
    if (data.success && data.data?.mediaRooms) {
      setMediaRooms(data.data.mediaRooms);
    } else {
      setError(data.error);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch media rooms");
  }
}

// Fetch lights
export async function fetchLights() {
  const { setLights, setError } = useDeviceStore.getState();
  try {
    const data = await fetchWithAuth("lights");
    if (data.success) {
      const lightsArray = Array.isArray(data.data) ? data.data : data.data?.lights || [];
      setLights(lightsArray);
    } else {
      setError(data.error);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch lights");
  }
}

// Fetch scenes
export async function fetchScenes() {
  const { setScenes, setError } = useDeviceStore.getState();
  try {
    const data = await fetchWithAuth("scenes");
    if (data.success) {
      const scenesArray = Array.isArray(data.data) ? data.data : [];
      setScenes(scenesArray);
    } else {
      setError(data.error);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch scenes");
  }
}

// Fetch quick actions
export async function fetchQuickActions() {
  const { setQuickActions, setError } = useDeviceStore.getState();
  try {
    const data = await fetchWithAuth("quickactions");
    if (data.success) {
      const quickActionsArray = Array.isArray(data.data) ? data.data : data.data?.quickActions || [];
      setQuickActions(quickActionsArray);
    } else {
      setError(data.error);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch quick actions");
  }
}

// Action helpers
export async function setLightState(id: string, level?: number, isOn?: boolean) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateLight } = useDeviceStore.getState();
  
  // Optimistic update
  if (level !== undefined) {
    updateLight(id, { level, isOn: level > 0 });
  } else if (isOn !== undefined) {
    updateLight(id, { isOn, level: isOn ? 65535 : 0 });
  }
  
  try {
    const response = await fetch("/api/crestron/lights", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, level, isOn }),
    });
    const data = await response.json();
    if (!data.success) {
      fetchLights();
    }
    return data.success;
  } catch {
    fetchLights();
    return false;
  }
}

export async function recallScene(id: string) {
  const headers = useAuthStore.getState().getAuthHeaders();
  
  try {
    const response = await fetch("/api/crestron/scenes", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

export async function setThermostatSetPoint(id: string, heatSetPoint?: number, coolSetPoint?: number) {
  // Don't send request if both setpoints are undefined
  if (heatSetPoint === undefined && coolSetPoint === undefined) {
    console.warn("setThermostatSetPoint called with both setpoints undefined");
    return false;
  }
  
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  
  // Optimistic update
  updateThermostat(id, { 
    ...(heatSetPoint !== undefined && { heatSetPoint }),
    ...(coolSetPoint !== undefined && { coolSetPoint }),
  });
  
  try {
    // Build request body, only including defined values
    const body: { id: string; action: string; heatSetPoint?: number; coolSetPoint?: number } = {
      id,
      action: "setPoint",
    };
    if (heatSetPoint !== undefined) {
      body.heatSetPoint = heatSetPoint;
    }
    if (coolSetPoint !== undefined) {
      body.coolSetPoint = coolSetPoint;
    }
    
    const response = await fetch("/api/crestron/thermostats", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

export async function setThermostatMode(id: string, mode: string) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  
  updateThermostat(id, { mode: mode as Thermostat["mode"] });
  
  try {
    const response = await fetch("/api/crestron/thermostats", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mode", mode }),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

export async function setThermostatFanMode(id: string, fanMode: FanMode) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  
  updateThermostat(id, { fanMode });
  
  try {
    const response = await fetch("/api/crestron/thermostats", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "fanMode", fanMode }),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

// Get thermostat pairs grouped by room
export function getThermostatPairs(): ThermostatPair[] {
  const { thermostats, rooms, areas, virtualRooms } = useDeviceStore.getState();
  
  // Build a map of roomId to virtual room (if it exists)
  const roomToVirtualRoomMap = new Map<string, { id: string; name: string }>();
  virtualRooms.forEach(virtualRoom => {
    virtualRoom.sourceRoomIds.forEach(sourceRoomId => {
      roomToVirtualRoomMap.set(sourceRoomId, { id: virtualRoom.id, name: virtualRoom.name });
    });
  });
  
  // Build a map of roomId to area name for sorting
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Group thermostats by roomId (or virtual room if applicable)
  const roomGroups = new Map<string, { roomId: string; roomName: string; thermostats: Thermostat[] }>();
  
  for (const thermostat of thermostats) {
    if (!thermostat.roomId) continue;
    
    // Check if this room is part of a virtual room
    const virtualRoom = roomToVirtualRoomMap.get(thermostat.roomId);
    const displayRoomId = virtualRoom ? virtualRoom.id : thermostat.roomId;
    const displayRoomName = virtualRoom ? virtualRoom.name : (rooms.find(r => r.id === thermostat.roomId)?.name || `Room ${thermostat.roomId}`);
    
    const existing = roomGroups.get(displayRoomId);
    if (existing) {
      existing.thermostats.push(thermostat);
    } else {
      roomGroups.set(displayRoomId, {
        roomId: displayRoomId,
        roomName: displayRoomName,
        thermostats: [thermostat],
      });
    }
  }
  
  // Convert to ThermostatPair format
  const pairs: ThermostatPair[] = [];
  
  for (const group of roomGroups.values()) {
    // Find floor heat and main thermostat
    const floorHeat = group.thermostats.find(t => isFloorHeat(t)) || null;
    const mainThermostat = group.thermostats.find(t => !isFloorHeat(t));
    
    // If we have a main thermostat, create a pair
    if (mainThermostat) {
      pairs.push({
        roomId: group.roomId,
        roomName: group.roomName,
        mainThermostat,
        floorHeat,
      });
    } else if (floorHeat) {
      // Room only has floor heat, treat it as the main
      pairs.push({
        roomId: group.roomId,
        roomName: group.roomName,
        mainThermostat: floorHeat,
        floorHeat: null,
      });
    }
  }
  
  // Sort pairs by area order (same as "By Zone" view), then by room name
  pairs.sort((a, b) => {
    const areaA = roomToAreaMap.get(a.roomId) || '';
    const areaB = roomToAreaMap.get(b.roomId) || '';
    const orderA = getZoneOrder(areaA);
    const orderB = getZoneOrder(areaB);
    if (orderA !== orderB) return orderA - orderB;
    // Secondary sort by room name
    return a.roomName.localeCompare(b.roomName);
  });
  
  return pairs;
}

// Zone display order - lower number = higher priority (displayed first)
// Order: 1st Floor → Master Suite → 2nd Floor → Lower Level
const ZONE_ORDER: Record<string, number> = {
  "1st floor": 1,
  "master suite": 2,
  "2nd floor": 3,
  "lower level": 4,
  "exterior": 5,
  "infrastructure": 6,
};

// Get zone sort order (lower = first)
function getZoneOrder(zoneName: string): number {
  const normalized = zoneName.toLowerCase().trim();
  return ZONE_ORDER[normalized] ?? 99; // Unknown zones go last
}

// Get all thermostat zones with computed data
export function getThermostatZonesWithData(): ThermostatZoneWithData[] {
  const { thermostats, thermostatZones, areas, rooms } = useDeviceStore.getState();
  
  // Build a map of roomId to area name for sorting thermostats
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Sort thermostats by their area order for Whole House display
  const sortedThermostatIds = [...thermostats]
    .sort((a, b) => {
      const areaA = a.roomId ? roomToAreaMap.get(a.roomId) || '' : '';
      const areaB = b.roomId ? roomToAreaMap.get(b.roomId) || '' : '';
      const orderA = getZoneOrder(areaA);
      const orderB = getZoneOrder(areaB);
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by room name
      const roomA = rooms.find(r => r.id === a.roomId)?.name || a.name;
      const roomB = rooms.find(r => r.id === b.roomId)?.name || b.name;
      return roomA.localeCompare(roomB);
    })
    .map(t => t.id);
  
  // Create "Whole House" zone (always first) with sorted thermostat IDs
  const wholeHouseZone: ThermostatZone = {
    id: "whole-house",
    name: "Whole House",
    thermostatIds: sortedThermostatIds,
    isBuiltIn: true,
  };
  
  // Create area-based zones
  const areaZones: ThermostatZone[] = areas.map(area => {
    // Find thermostats in rooms that belong to this area
    const areaRoomIds = area.roomIds;
    const zoneThermostatIds = thermostats
      .filter(t => t.roomId && areaRoomIds.includes(t.roomId))
      .filter(t => !isFloorHeat(t)) // Exclude floor heat from zone counts
      .map(t => t.id);
    
    return {
      id: area.id,
      name: area.name,
      thermostatIds: zoneThermostatIds,
      isBuiltIn: true,
    };
  }).filter(zone => zone.thermostatIds.length > 0); // Only include zones with thermostats
  
  // Sort area zones by the defined order
  areaZones.sort((a, b) => getZoneOrder(a.name) - getZoneOrder(b.name));
  
  // Combine with custom zones (Whole House first, then sorted area zones, then custom)
  const allZones = [wholeHouseZone, ...areaZones, ...thermostatZones];
  
  // Compute data for each zone
  return allZones.map(zone => {
    // For Whole House, preserve the sorted order; for others, sort by area then name
    let zoneThermostats = thermostats.filter(t => zone.thermostatIds.includes(t.id));
    
    if (zone.id === "whole-house") {
      // Sort according to the pre-sorted thermostatIds order
      zoneThermostats = zone.thermostatIds
        .map(id => thermostats.find(t => t.id === id))
        .filter((t): t is Thermostat => t !== undefined);
    }
    
    const mainThermostats = zoneThermostats.filter(t => !isFloorHeat(t));
    
    // Calculate averages from main thermostats only
    const activeThermostats = mainThermostats.filter(t => t.mode !== 'off');
    const avgCurrentTemp = mainThermostats.length > 0
      ? Math.round(mainThermostats.reduce((sum, t) => sum + t.currentTemp, 0) / mainThermostats.length)
      : 0;
    
    const avgSetPoint = activeThermostats.length > 0
      ? Math.round(activeThermostats.reduce((sum, t) => {
          return sum + (t.mode === 'heat' ? t.heatSetPoint : t.coolSetPoint);
        }, 0) / activeThermostats.length)
      : 70;
    
    // Find dominant mode (most common)
    const modeCounts: Record<ThermostatMode, number> = { off: 0, heat: 0, cool: 0, auto: 0 };
    mainThermostats.forEach(t => modeCounts[t.mode]++);
    const dominantMode = (Object.entries(modeCounts) as [ThermostatMode, number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'off';
    
    // Find dominant fan mode
    const fanModeCounts: Record<FanMode, number> = { auto: 0, on: 0 };
    mainThermostats.forEach(t => fanModeCounts[t.fanMode]++);
    const dominantFanMode = (Object.entries(fanModeCounts) as [FanMode, number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'auto';
    
    return {
      zone,
      thermostats: zoneThermostats,
      avgCurrentTemp,
      avgSetPoint,
      dominantMode,
      dominantFanMode,
      activeCount: activeThermostats.length,
    };
  });
}

// Set mode for all thermostats in a zone
export async function setZoneThermostatMode(
  zoneId: string,
  mode: ThermostatMode
): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { thermostats, updateThermostat } = useDeviceStore.getState();
  const zones = getThermostatZonesWithData();
  const zone = zones.find(z => z.zone.id === zoneId);
  
  if (!zone) return false;
  
  // Get main thermostats in zone (not floor heat)
  const zoneMainThermostats = zone.thermostats.filter(t => !isFloorHeat(t));
  const zoneFloorHeat = zone.thermostats.filter(t => isFloorHeat(t));
  
  // Floor heat mode (only heat or off)
  const floorHeatMode: ThermostatMode = mode === 'heat' ? 'heat' : 'off';
  
  // Optimistic updates
  zoneMainThermostats.forEach(t => updateThermostat(t.id, { mode }));
  zoneFloorHeat.forEach(t => updateThermostat(t.id, { mode: floorHeatMode }));
  
  try {
    // Send mode changes in parallel
    const results = await Promise.all([
      ...zoneMainThermostats.map(async (t) => {
        const response = await fetch("/api/crestron/thermostats", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, action: "mode", mode }),
        });
        return (await response.json()).success;
      }),
      ...zoneFloorHeat.map(async (t) => {
        const response = await fetch("/api/crestron/thermostats", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, action: "mode", mode: floorHeatMode }),
        });
        return (await response.json()).success;
      }),
    ]);
    
    return results.every(Boolean);
  } catch {
    return false;
  }
}

// Set fan mode for all thermostats in a zone
export async function setZoneThermostatFanMode(
  zoneId: string,
  fanMode: FanMode
): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  const zones = getThermostatZonesWithData();
  const zone = zones.find(z => z.zone.id === zoneId);
  
  if (!zone) return false;
  
  // Only set fan mode on main thermostats (not floor heat)
  const zoneMainThermostats = zone.thermostats.filter(t => !isFloorHeat(t));
  
  // Optimistic updates
  zoneMainThermostats.forEach(t => updateThermostat(t.id, { fanMode }));
  
  try {
    const results = await Promise.all(
      zoneMainThermostats.map(async (t) => {
        const response = await fetch("/api/crestron/thermostats", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, action: "fanMode", fanMode }),
        });
        return (await response.json()).success;
      })
    );
    
    return results.every(Boolean);
  } catch {
    return false;
  }
}

// Set temperature for all thermostats in a zone
export async function setZoneThermostatTemp(
  zoneId: string,
  temperature: number,
  mode?: ThermostatMode
): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  const zones = getThermostatZonesWithData();
  const zone = zones.find(z => z.zone.id === zoneId);
  
  if (!zone) return false;
  
  const zoneThermostats = zone.thermostats;
  
  // Determine setpoint payload based on mode
  const effectiveMode = mode || zone.dominantMode;
  const setpointPayload = effectiveMode === "heat" 
    ? { heatSetPoint: temperature }
    : effectiveMode === "cool"
      ? { coolSetPoint: temperature }
      : { heatSetPoint: temperature, coolSetPoint: temperature };
  
  // Optimistic updates
  zoneThermostats.forEach(t => {
    const updates: Partial<Thermostat> = {
      ...setpointPayload,
    };
    if (mode) {
      updates.mode = isFloorHeat(t) ? (mode === 'heat' ? 'heat' : 'off') : mode;
    }
    updateThermostat(t.id, updates);
  });
  
  try {
    // If mode is provided, set mode first
    if (mode) {
      const modeResults = await Promise.all(
        zoneThermostats.map(async (t) => {
          const thermostatMode = isFloorHeat(t) ? (mode === 'heat' ? 'heat' : 'off') : mode;
          const response = await fetch("/api/crestron/thermostats", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ id: t.id, action: "mode", mode: thermostatMode }),
          });
          return (await response.json()).success;
        })
      );
      
      if (!modeResults.every(Boolean)) {
        console.warn("Some zone thermostat mode changes failed");
      }
    }
    
    // Set temperature on all thermostats
    const results = await Promise.all(
      zoneThermostats.map(async (t) => {
        // Build request body, only including defined values
        const body: { id: string; action: string; heatSetPoint?: number; coolSetPoint?: number } = {
          id: t.id,
          action: "setPoint",
        };
        if (setpointPayload.heatSetPoint !== undefined) {
          body.heatSetPoint = setpointPayload.heatSetPoint;
        }
        if (setpointPayload.coolSetPoint !== undefined) {
          body.coolSetPoint = setpointPayload.coolSetPoint;
        }
        
        const response = await fetch("/api/crestron/thermostats", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return (await response.json()).success;
      })
    );
    
    return results.every(Boolean);
  } catch {
    return false;
  }
}

// Coordinated mode change for room thermostats (syncs main + floor heat)
export async function setRoomThermostatMode(
  mainThermostatId: string, 
  floorHeatId: string | null, 
  mode: ThermostatMode
): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  
  // Determine floor heat mode based on main thermostat mode
  // Floor heat only supports heat or off
  const floorHeatMode: ThermostatMode = mode === 'heat' ? 'heat' : 'off';
  
  // Optimistic updates
  updateThermostat(mainThermostatId, { mode });
  if (floorHeatId) {
    updateThermostat(floorHeatId, { mode: floorHeatMode });
  }
  
  try {
    // Send mode change to main thermostat
    const mainResponse = await fetch("/api/crestron/thermostats", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: mainThermostatId, action: "mode", mode }),
    });
    const mainData = await mainResponse.json();
    
    // If we have a floor heat, sync its mode
    if (floorHeatId) {
      const floorResponse = await fetch("/api/crestron/thermostats", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: floorHeatId, action: "mode", mode: floorHeatMode }),
      });
      const floorData = await floorResponse.json();
      
      return mainData.success && floorData.success;
    }
    
    return mainData.success;
  } catch {
    return false;
  }
}

// Set floor heat mode when user toggles it directly
export async function setFloorHeatMode(
  floorHeatId: string,
  mainThermostatId: string | null,
  mode: ThermostatMode
): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  
  // Floor heat only supports heat or off
  const effectiveMode: ThermostatMode = mode === 'heat' ? 'heat' : 'off';
  
  // Optimistic update for floor heat
  updateThermostat(floorHeatId, { mode: effectiveMode });
  
  // If floor heat is turned to heat, main thermostat should also be heat
  if (effectiveMode === 'heat' && mainThermostatId) {
    updateThermostat(mainThermostatId, { mode: 'heat' });
  }
  
  try {
    // Send mode change to floor heat
    const floorResponse = await fetch("/api/crestron/thermostats", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: floorHeatId, action: "mode", mode: effectiveMode }),
    });
    const floorData = await floorResponse.json();
    
    // If floor heat is set to heat, also set main thermostat to heat
    if (effectiveMode === 'heat' && mainThermostatId) {
      const mainResponse = await fetch("/api/crestron/thermostats", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: mainThermostatId, action: "mode", mode: 'heat' }),
      });
      const mainData = await mainResponse.json();
      
      return floorData.success && mainData.success;
    }
    
    return floorData.success;
  } catch {
    return false;
  }
}

// Set temperature for all thermostats
// When mode is provided, also sets the mode (turning on thermostats that are off)
export async function setAllThermostatsTemp(
  temperature: number, 
  mode?: ThermostatMode
): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { thermostats, updateThermostat } = useDeviceStore.getState();
  
  // Optimistic update all thermostats
  for (const thermostat of thermostats) {
    const updates: Partial<Thermostat> = {
      heatSetPoint: temperature, 
      coolSetPoint: temperature,
    };
    if (mode) {
      updates.mode = mode;
    }
    updateThermostat(thermostat.id, updates);
  }
  
  try {
    // If mode is provided, set mode first for all thermostats (in parallel)
    if (mode) {
      const modeResults = await Promise.all(
        thermostats.map(async (thermostat) => {
          const response = await fetch("/api/crestron/thermostats", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ 
              id: thermostat.id, 
              action: "mode", 
              mode 
            }),
          });
          const data = await response.json();
          return data.success;
        })
      );
      
      // If any mode set failed, still continue with temperature
      if (!modeResults.every(Boolean)) {
        console.warn("Some thermostat mode changes failed");
      }
    }
    
    // Send setpoint to all thermostats in parallel
    const setpointPayload = mode === "heat" 
      ? { heatSetPoint: temperature }
      : mode === "cool"
        ? { coolSetPoint: temperature }
        : { heatSetPoint: temperature, coolSetPoint: temperature };
    
    const results = await Promise.all(
      thermostats.map(async (thermostat) => {
        // Build request body, only including defined values
        const body: { id: string; action: string; heatSetPoint?: number; coolSetPoint?: number } = {
          id: thermostat.id,
          action: "setPoint",
        };
        if (setpointPayload.heatSetPoint !== undefined) {
          body.heatSetPoint = setpointPayload.heatSetPoint;
        }
        if (setpointPayload.coolSetPoint !== undefined) {
          body.coolSetPoint = setpointPayload.coolSetPoint;
        }
        
        const response = await fetch("/api/crestron/thermostats", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return data.success;
      })
    );
    
    return results.every(Boolean);
  } catch {
    return false;
  }
}

// Check temperature satisfaction and turn off floor heat if needed
export async function checkTemperatureSatisfaction(): Promise<void> {
  const headers = useAuthStore.getState().getAuthHeaders();
  const pairs = getThermostatPairs();
  
  for (const pair of pairs) {
    // Only check if we have both a main thermostat and floor heat
    if (!pair.floorHeat) continue;
    
    // Only act if main thermostat is in heat mode and floor heat is on
    if (pair.mainThermostat.mode !== 'heat') continue;
    if (pair.floorHeat.mode !== 'heat') continue;
    
    // Check if main thermostat's temperature is satisfied
    if (isTemperatureSatisfied(pair.mainThermostat)) {
      // Turn off floor heat
      const { updateThermostat } = useDeviceStore.getState();
      updateThermostat(pair.floorHeat.id, { mode: 'off' });
      
      try {
        await fetch("/api/crestron/thermostats", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: pair.floorHeat.id, action: "mode", mode: "off" }),
        });
      } catch {
        // Silently fail - will retry on next poll
      }
    }
  }
}

export async function setDoorLockState(id: string, isLocked: boolean) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateDoorLock } = useDeviceStore.getState();
  
  updateDoorLock(id, { isLocked });
  
  try {
    const response = await fetch("/api/crestron/doorlocks", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, isLocked }),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

// Media Room control functions

export async function setMediaRoomPower(id: string, powerState: "on" | "off") {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateMediaRoom } = useDeviceStore.getState();
  
  // Optimistic update
  updateMediaRoom(id, { 
    isPoweredOn: powerState === "on",
    currentPowerState: powerState === "on" ? "On" : "Off",
  });
  
  try {
    // For power ON: Crestron requires selecting a source to power on the room
    // The selectsource API call both sets the source AND powers on the room
    if (powerState === "on") {
      // Fetch the room data to get the current source index
      const roomResponse = await fetch(`/api/crestron/media?roomId=${id}`, {
        method: "GET",
        headers,
        cache: 'no-store',
      });
      const roomData = await roomResponse.json();
      
      if (!roomData.success || !roomData.data) {
        await fetchMediaRooms();
        return false;
      }
      
      // Get the current source index (or default to 0)
      const rawRoom = roomData.data;
      const sourceIndex = rawRoom.currentProviderId ?? 0;
      
      // Select the source - this also powers on the room
      const sourceResponse = await fetch("/api/crestron/media", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "source", sourceIndex }),
      });
      const sourceData = await sourceResponse.json();
      
      if (!sourceData.success) {
        await fetchMediaRooms();
        return false;
      }
      
      // Selecting a source powers on the room automatically
      // Don't refresh immediately - Crestron is slow to update its state
      // The optimistic update shows the correct state, next poll will sync
      return true;
    }
    
    // For power OFF: use the standard power endpoint directly
    const response = await fetch("/api/crestron/media", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "power", powerState }),
    });
    const data = await response.json();
    
    // Refresh media room data from server to get actual state
    if (data.success) {
      await fetchMediaRooms();
    } else {
      // On failure, revert optimistic update by refreshing
      await fetchMediaRooms();
    }
    
    return data.success;
  } catch {
    // On error, revert optimistic update by refreshing
    await fetchMediaRooms();
    return false;
  }
}

export async function setMediaRoomVolume(id: string, volumePercent: number) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateMediaRoom } = useDeviceStore.getState();
  
  // Clamp volume to 0-100
  const clampedVolume = Math.max(0, Math.min(100, volumePercent));
  
  // Optimistic update
  updateMediaRoom(id, { 
    volumePercent: clampedVolume,
    currentVolumeLevel: Math.round((clampedVolume / 100) * 65535),
  });
  
  try {
    const response = await fetch("/api/crestron/media", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "volume", volumePercent: clampedVolume }),
    });
    const data = await response.json();
    
    // Refresh media room data to ensure volume matches actual device state
    if (data.success) {
      await fetchMediaRooms();
    }
    
    return data.success;
  } catch {
    await fetchMediaRooms();
    return false;
  }
}

export async function setMediaRoomMute(id: string, muted: boolean) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateMediaRoom } = useDeviceStore.getState();
  
  // Optimistic update
  updateMediaRoom(id, { 
    isMuted: muted,
    currentMuteState: muted ? "Muted" : "Unmuted",
  });
  
  try {
    const response = await fetch("/api/crestron/media", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mute", muted }),
    });
    const data = await response.json();
    
    // Refresh media room data to ensure mute state matches actual device state
    if (data.success) {
      await fetchMediaRooms();
    }
    
    return data.success;
  } catch {
    await fetchMediaRooms();
    return false;
  }
}

export async function selectMediaRoomSource(id: string, sourceIndex: number) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateMediaRoom, mediaRooms } = useDeviceStore.getState();
  
  // Find the media room to get the source name
  const mediaRoom = mediaRooms.find(m => m.id === id);
  const sourceName = mediaRoom?.availableProviders?.[sourceIndex];
  
  // Optimistic update
  updateMediaRoom(id, { 
    currentProviderId: sourceIndex,
    currentSourceName: sourceName,
  });
  
  try {
    const response = await fetch("/api/crestron/media", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "source", sourceIndex }),
    });
    const data = await response.json();
    
    // Refresh media room data to ensure source matches actual device state
    if (data.success) {
      await fetchMediaRooms();
    }
    
    return data.success;
  } catch {
    await fetchMediaRooms();
    return false;
  }
}

// Transport controls (play/pause/skip) - may not be available on all Crestron systems
export type TransportAction = "play" | "pause" | "stop" | "next" | "previous";

export async function mediaRoomTransport(id: string, action: TransportAction): Promise<boolean> {
  const headers = useAuthStore.getState().getAuthHeaders();
  
  try {
    const response = await fetch("/api/crestron/media", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

export async function mediaRoomPlay(id: string): Promise<boolean> {
  return mediaRoomTransport(id, "play");
}

export async function mediaRoomPause(id: string): Promise<boolean> {
  return mediaRoomTransport(id, "pause");
}

export async function mediaRoomStop(id: string): Promise<boolean> {
  return mediaRoomTransport(id, "stop");
}

export async function mediaRoomNext(id: string): Promise<boolean> {
  return mediaRoomTransport(id, "next");
}

export async function mediaRoomPrevious(id: string): Promise<boolean> {
  return mediaRoomTransport(id, "previous");
}

// Get media rooms grouped by zone (similar to thermostat zones)
export interface MediaRoomZoneWithData {
  zone: {
    id: string;
    name: string;
  };
  mediaRooms: MediaRoom[];
  totalRooms: number;
  playingCount: number;       // Number of rooms with power on
  avgVolume: number;          // Average volume of playing rooms
}

export function getMediaRoomZonesWithData(): MediaRoomZoneWithData[] {
  const { mediaRooms, areas, rooms } = useDeviceStore.getState();
  
  if (mediaRooms.length === 0) return [];
  
  // Build a map of roomId to area name
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Zone display order (same as thermostats)
  const ZONE_ORDER: Record<string, number> = {
    "1st floor": 1,
    "master suite": 2,
    "2nd floor": 3,
    "lower level": 4,
    "exterior": 5,
    "infrastructure": 6,
  };
  
  const getZoneOrder = (zoneName: string): number => {
    const normalized = zoneName.toLowerCase().trim();
    return ZONE_ORDER[normalized] ?? 99;
  };
  
  // Sort media rooms by area order
  const sortedMediaRooms = [...mediaRooms].sort((a, b) => {
    const areaA = a.roomId ? roomToAreaMap.get(a.roomId) || '' : '';
    const areaB = b.roomId ? roomToAreaMap.get(b.roomId) || '' : '';
    const orderA = getZoneOrder(areaA);
    const orderB = getZoneOrder(areaB);
    if (orderA !== orderB) return orderA - orderB;
    const roomA = rooms.find(r => r.id === a.roomId)?.name || a.name;
    const roomB = rooms.find(r => r.id === b.roomId)?.name || b.name;
    return roomA.localeCompare(roomB);
  });
  
  // Calculate whole house stats
  const playingRooms = sortedMediaRooms.filter(m => m.isPoweredOn);
  const avgVolume = playingRooms.length > 0
    ? Math.round(playingRooms.reduce((sum, m) => sum + m.volumePercent, 0) / playingRooms.length)
    : 0;
  
  // Whole House zone
  const wholeHouseZone: MediaRoomZoneWithData = {
    zone: { id: "whole-house", name: "Whole House" },
    mediaRooms: sortedMediaRooms,
    totalRooms: sortedMediaRooms.length,
    playingCount: playingRooms.length,
    avgVolume,
  };
  
  // Create area-based zones
  const areaZones: MediaRoomZoneWithData[] = areas.map(area => {
    const zoneMediaRooms = sortedMediaRooms.filter(m => 
      m.roomId && roomToAreaMap.get(m.roomId) === area.name
    );
    
    const zonePlaying = zoneMediaRooms.filter(m => m.isPoweredOn);
    const zoneAvgVolume = zonePlaying.length > 0
      ? Math.round(zonePlaying.reduce((sum, m) => sum + m.volumePercent, 0) / zonePlaying.length)
      : 0;
    
    return {
      zone: { id: area.id, name: area.name },
      mediaRooms: zoneMediaRooms,
      totalRooms: zoneMediaRooms.length,
      playingCount: zonePlaying.length,
      avgVolume: zoneAvgVolume,
    };
  }).filter(zone => zone.mediaRooms.length > 0);
  
  // Sort area zones by order
  areaZones.sort((a, b) => getZoneOrder(a.zone.name) - getZoneOrder(b.zone.name));
  
  return [wholeHouseZone, ...areaZones];
}

// Set power for all media rooms in a zone
export async function setZoneMediaRoomPower(zoneId: string, powerState: "on" | "off"): Promise<boolean> {
  const zones = getMediaRoomZonesWithData();
  const zone = zones.find(z => z.zone.id === zoneId);
  
  if (!zone) return false;
  
  // Set power for all rooms in zone in parallel
  const results = await Promise.all(
    zone.mediaRooms.map(m => setMediaRoomPower(m.id, powerState))
  );
  
  return results.every(Boolean);
}

// Set volume for all media rooms in a zone
export async function setZoneMediaRoomVolume(zoneId: string, volumePercent: number): Promise<boolean> {
  const zones = getMediaRoomZonesWithData();
  const zone = zones.find(z => z.zone.id === zoneId);
  
  if (!zone) return false;
  
  // Only set volume on rooms that are powered on
  const playingRooms = zone.mediaRooms.filter(m => m.isPoweredOn);
  
  const results = await Promise.all(
    playingRooms.map(m => setMediaRoomVolume(m.id, volumePercent))
  );
  
  return results.every(Boolean);
}

// Set source for all media rooms in a zone that have that source available
export async function setZoneMediaRoomSource(zoneId: string, sourceName: string): Promise<{ success: number; skipped: number }> {
  const zones = getMediaRoomZonesWithData();
  const zone = zones.find(z => z.zone.id === zoneId);
  
  if (!zone) return { success: 0, skipped: 0 };
  
  let successCount = 0;
  let skippedCount = 0;
  
  // Process each room - only select source if room has that source available
  const promises = zone.mediaRooms.map(async (room) => {
    // Find the source index by name in this room's available providers
    const sourceIndex = room.availableProviders.findIndex(
      provider => provider.toLowerCase() === sourceName.toLowerCase()
    );
    
    if (sourceIndex === -1) {
      // Room doesn't have this source - skip it
      skippedCount++;
      return false;
    }
    
    // Room has this source - select it (this will also power on the room)
    const result = await selectMediaRoomSource(room.id, sourceIndex);
    if (result) {
      successCount++;
    }
    return result;
  });
  
  await Promise.all(promises);
  
  return { success: successCount, skipped: skippedCount };
}

// Virtual Rooms CRUD operations

export async function fetchVirtualRooms() {
  const { setVirtualRooms, setError } = useDeviceStore.getState();
  try {
    const response = await fetch("/api/crestron/virtual-rooms", { cache: 'no-store' });
    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      setVirtualRooms(data.data);
    } else {
      setError(data.error || "Failed to fetch virtual rooms");
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch virtual rooms");
  }
}

export async function createVirtualRoom(name: string, sourceRoomIds: string[], areaId?: string, areaName?: string) {
  const { setVirtualRooms, virtualRooms, rooms } = useDeviceStore.getState();
  
  // If area not provided, try to find it from source rooms
  let finalAreaId = areaId;
  let finalAreaName = areaName;
  
  if (!finalAreaId || !finalAreaName) {
    for (const roomId of sourceRoomIds) {
      const room = rooms.find(r => r.id === roomId);
      if (room?.areaId && room?.areaName) {
        finalAreaId = room.areaId;
        finalAreaName = room.areaName;
        break;
      }
    }
  }
  
  try {
    const response = await fetch("/api/crestron/virtual-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceRoomIds, areaId: finalAreaId, areaName: finalAreaName }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      // Add the new virtual room to state
      setVirtualRooms([...virtualRooms, data.data]);
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateVirtualRoom(id: string, name?: string, sourceRoomIds?: string[], areaId?: string, areaName?: string) {
  const { setVirtualRooms, virtualRooms } = useDeviceStore.getState();
  
  try {
    const response = await fetch("/api/crestron/virtual-rooms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, sourceRoomIds, areaId, areaName }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      // Update the virtual room in state
      setVirtualRooms(virtualRooms.map(room => room.id === id ? data.data : room));
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteVirtualRoom(id: string) {
  const { setVirtualRooms, virtualRooms } = useDeviceStore.getState();
  
  try {
    const response = await fetch(`/api/crestron/virtual-rooms?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (data.success) {
      // Remove the virtual room from state
      setVirtualRooms(virtualRooms.filter(room => room.id !== id));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Move a room to a different area
export async function moveRoomToArea(
  roomId: string,
  roomName: string,
  sourceAreaId: string | null,
  targetAreaId: string
): Promise<boolean> {
  const { areas, rooms, setAreas, setRooms } = useDeviceStore.getState();
  
  // Optimistic update - update local state immediately
  const updatedAreas = areas.map(area => {
    if (area.id === sourceAreaId) {
      // Remove from source area
      return { ...area, roomIds: area.roomIds.filter(id => id !== roomId) };
    }
    if (area.id === targetAreaId) {
      // Add to target area
      return { ...area, roomIds: [...area.roomIds, roomId] };
    }
    return area;
  });
  
  // Update room's areaId and areaName
  const targetArea = areas.find(a => a.id === targetAreaId);
  const updatedRooms = rooms.map(room => {
    if (room.id === roomId) {
      return {
        ...room,
        areaId: targetAreaId === "unassigned" ? undefined : targetAreaId,
        areaName: targetAreaId === "unassigned" ? undefined : targetArea?.name,
      };
    }
    return room;
  });
  
  setAreas(updatedAreas);
  setRooms(updatedRooms);
  
  try {
    const response = await fetch("/api/crestron/areas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, sourceAreaId, targetAreaId }),
    });
    const data = await response.json();
    
    if (!data.success) {
      // Revert on failure - refetch data
      await fetchAllData();
      return false;
    }
    
    return true;
  } catch {
    // Revert on error - refetch data
    await fetchAllData();
    return false;
  }
}

// Create a new area
export async function createArea(name: string): Promise<boolean> {
  try {
    const response = await fetch("/api/crestron/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    
    if (data.success && data.data) {
      // Add the new area to state
      const { areas, setAreas } = useDeviceStore.getState();
      setAreas([...areas, data.data]);
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

// Delete an area
export async function deleteArea(areaId: string): Promise<boolean> {
  const { areas, setAreas } = useDeviceStore.getState();
  
  // Optimistic update
  const originalAreas = [...areas];
  setAreas(areas.filter(a => a.id !== areaId));
  
  try {
    const response = await fetch(`/api/crestron/areas?id=${encodeURIComponent(areaId)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    
    if (!data.success) {
      // Revert on failure
      setAreas(originalAreas);
      return false;
    }
    
    // Refetch to get updated room assignments
    await fetchAllData();
    return true;
  } catch {
    // Revert on error
    setAreas(originalAreas);
    return false;
  }
}

// Lighting zone interface (similar to ThermostatZoneWithData)
export interface LightingZoneWithData {
  zone: {
    id: string;
    name: string;
  };
  lights: Light[];
  rooms: Room[];
  roomGroups: LightingRoomGroup[]; // Lights grouped by room/virtual room
  totalLights: number;
  lightsOn: number;
  avgBrightness: number; // 0-100 percentage
}

// Lighting room group interface
export interface LightingRoomGroup {
  roomId: string;
  roomName: string;
  lights: Light[];
  lightsOn: number;
  totalLights: number;
  avgBrightness: number;
  equipment: Light[];
}

// Get lighting zones grouped by area (similar to thermostat zones)
export function getLightingZonesWithData(): LightingZoneWithData[] {
  const { lights, areas, rooms, virtualRooms } = useDeviceStore.getState();
  
  // Separate lights from equipment controls
  const { actualLights, equipment } = separateLightsAndEquipment(lights);
  
  // Build a map of roomId to virtual room (if it exists)
  const roomToVirtualRoomMap = new Map<string, { id: string; name: string }>();
  virtualRooms.forEach(virtualRoom => {
    virtualRoom.sourceRoomIds.forEach(sourceRoomId => {
      roomToVirtualRoomMap.set(sourceRoomId, { id: virtualRoom.id, name: virtualRoom.name });
    });
  });
  
  // Build a map of roomId to area name
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Build a map of roomId to equipment
  const equipmentByRoom = new Map<string, Light[]>();
  for (const equip of equipment) {
    if (!equip.roomId) continue;
    const virtualRoom = roomToVirtualRoomMap.get(equip.roomId);
    const displayRoomId = virtualRoom ? virtualRoom.id : equip.roomId;
    const existing = equipmentByRoom.get(displayRoomId) || [];
    existing.push(equip);
    equipmentByRoom.set(displayRoomId, existing);
  }
  
  // Helper function to group lights by room/virtual room
  // allowedRoomIds: optional set of room IDs to include (for zone-specific filtering)
  const groupLightsByRoom = (lightsToGroup: Light[], allowedRoomIds?: Set<string>): LightingRoomGroup[] => {
    const roomGroups = new Map<string, { roomId: string; roomName: string; lights: Light[]; equipment: Light[] }>();
    
    for (const light of lightsToGroup) {
      if (!light.roomId) continue;
      
      // Check if this room is part of a virtual room
      const virtualRoom = roomToVirtualRoomMap.get(light.roomId);
      const displayRoomId = virtualRoom ? virtualRoom.id : light.roomId;
      const displayRoomName = virtualRoom ? virtualRoom.name : (rooms.find(r => r.id === light.roomId)?.name || `Room ${light.roomId}`);
      
      const existing = roomGroups.get(displayRoomId);
      if (existing) {
        existing.lights.push(light);
      } else {
        roomGroups.set(displayRoomId, {
          roomId: displayRoomId,
          roomName: displayRoomName,
          lights: [light],
          equipment: equipmentByRoom.get(displayRoomId) || [],
        });
      }
    }
    
    // Also add rooms that only have equipment (no lights)
    // Only add if the room is in the allowed set (or if no filter is provided for Whole House)
    for (const [roomId, roomEquipment] of equipmentByRoom.entries()) {
      if (!roomGroups.has(roomId)) {
        // Skip if we have an allowed set and this room isn't in it
        if (allowedRoomIds && !allowedRoomIds.has(roomId)) {
          continue;
        }
        const virtualRoom = roomToVirtualRoomMap.get(roomId);
        const displayRoomName = virtualRoom ? virtualRoom.name : (rooms.find(r => r.id === roomId)?.name || `Room ${roomId}`);
        roomGroups.set(roomId, {
          roomId,
          roomName: displayRoomName,
          lights: [],
          equipment: roomEquipment,
        });
      }
    }
    
    // Convert to LightingRoomGroup format
    const groups: LightingRoomGroup[] = [];
    for (const group of roomGroups.values()) {
      const lightsOn = group.lights.filter(l => l.isOn || l.level > 0).length;
      const avgBrightness = group.lights.length > 0
        ? Math.round((group.lights.reduce((sum, l) => sum + Math.round((l.level / 65535) * 100), 0) / group.lights.length))
        : 0;
      
      groups.push({
        roomId: group.roomId,
        roomName: group.roomName,
        lights: group.lights,
        lightsOn,
        totalLights: group.lights.length,
        avgBrightness,
        equipment: group.equipment,
      });
    }
    
    // Sort by area order, then by room name
    groups.sort((a, b) => {
      const areaA = roomToAreaMap.get(a.roomId) || '';
      const areaB = roomToAreaMap.get(b.roomId) || '';
      const orderA = getZoneOrder(areaA);
      const orderB = getZoneOrder(areaB);
      if (orderA !== orderB) return orderA - orderB;
      return a.roomName.localeCompare(b.roomName);
    });
    
    return groups;
  };
  
  // Sort lights by area order for Whole House display
  const sortedLightIds = [...actualLights]
    .sort((a, b) => {
      const areaA = a.roomId ? roomToAreaMap.get(a.roomId) || '' : '';
      const areaB = b.roomId ? roomToAreaMap.get(b.roomId) || '' : '';
      const orderA = getZoneOrder(areaA);
      const orderB = getZoneOrder(areaB);
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by room name
      const roomA = rooms.find(r => r.id === a.roomId)?.name || a.name;
      const roomB = rooms.find(r => r.id === b.roomId)?.name || b.name;
      return roomA.localeCompare(roomB);
    })
    .map(l => l.id);
  
  // Create "Whole House" zone (always first)
  const wholeHouseLights = sortedLightIds
    .map(id => actualLights.find(l => l.id === id))
    .filter((l): l is Light => l !== undefined);
  
  const wholeHouseRooms = Array.from(new Set(wholeHouseLights.map(l => l.roomId).filter((id): id is string => !!id)))
    .map(roomId => {
      const virtualRoom = roomToVirtualRoomMap.get(roomId);
      if (virtualRoom) {
        return virtualRooms.find(vr => vr.id === virtualRoom.id) 
          ? { id: virtualRoom.id, name: virtualRoom.name, areaId: virtualRooms.find(vr => vr.id === virtualRoom.id)?.areaId, areaName: virtualRooms.find(vr => vr.id === virtualRoom.id)?.areaName } as Room
          : rooms.find(r => r.id === roomId);
      }
      return rooms.find(r => r.id === roomId);
    })
    .filter((r): r is Room => r !== undefined);
  
  const wholeHouseOn = wholeHouseLights.filter(l => l.isOn || l.level > 0).length;
  const wholeHouseAvgBrightness = wholeHouseLights.length > 0
    ? Math.round((wholeHouseLights.reduce((sum, l) => sum + Math.round((l.level / 65535) * 100), 0) / wholeHouseLights.length))
    : 0;
  
  const wholeHouseRoomGroups = groupLightsByRoom(wholeHouseLights);
  
  const wholeHouseZone: LightingZoneWithData = {
    zone: {
      id: "whole-house",
      name: "Whole House",
    },
    lights: wholeHouseLights,
    rooms: wholeHouseRooms,
    roomGroups: wholeHouseRoomGroups,
    totalLights: wholeHouseLights.length,
    lightsOn: wholeHouseOn,
    avgBrightness: wholeHouseAvgBrightness,
  };
  
  // Create area-based zones
  const areaZones: LightingZoneWithData[] = areas.map(area => {
    const areaRoomIds = area.roomIds;
    const zoneLights = actualLights.filter(l => {
      if (!l.roomId) return false;
      // Check if light's room is in area, or if it's part of a virtual room that's in the area
      if (areaRoomIds.includes(l.roomId)) return true;
      const virtualRoom = roomToVirtualRoomMap.get(l.roomId);
      if (virtualRoom && virtualRooms.find(vr => vr.id === virtualRoom.id && vr.areaId === area.id)) return true;
      return false;
    });
    
    // Get unique rooms (including virtual rooms)
    const zoneRoomIds = new Set<string>();
    zoneLights.forEach(l => {
      if (l.roomId) {
        const virtualRoom = roomToVirtualRoomMap.get(l.roomId);
        if (virtualRoom) {
          zoneRoomIds.add(virtualRoom.id);
        } else {
          zoneRoomIds.add(l.roomId);
        }
      }
    });
    
    const zoneRooms = Array.from(zoneRoomIds)
      .map(roomId => {
        const virtualRoom = virtualRooms.find(vr => vr.id === roomId);
        if (virtualRoom) {
          return { id: virtualRoom.id, name: virtualRoom.name, areaId: virtualRoom.areaId, areaName: virtualRoom.areaName } as Room;
        }
        return rooms.find(r => r.id === roomId);
      })
      .filter((r): r is Room => r !== undefined);
    
    const zoneOn = zoneLights.filter(l => l.isOn || l.level > 0).length;
    const zoneAvgBrightness = zoneLights.length > 0
      ? Math.round((zoneLights.reduce((sum, l) => sum + Math.round((l.level / 65535) * 100), 0) / zoneLights.length))
      : 0;
    
    // Pass allowed room IDs to filter equipment rooms to this zone only
    const zoneRoomGroups = groupLightsByRoom(zoneLights, new Set(areaRoomIds));
    
    return {
      zone: {
        id: area.id,
        name: area.name,
      },
      lights: zoneLights,
      rooms: zoneRooms,
      roomGroups: zoneRoomGroups,
      totalLights: zoneLights.length,
      lightsOn: zoneOn,
      avgBrightness: zoneAvgBrightness,
    };
  }).filter(zone => zone.lights.length > 0); // Only include zones with lights
  
  // Sort area zones by the defined order
  areaZones.sort((a, b) => getZoneOrder(a.zone.name) - getZoneOrder(b.zone.name));
  
  // Combine: Whole House first, then sorted area zones
  return [wholeHouseZone, ...areaZones];
}

// Get lights grouped by room (for room view)
export function getLightingRoomGroups(): LightingRoomGroup[] {
  const { lights, rooms, areas, virtualRooms } = useDeviceStore.getState();
  
  // Separate lights from equipment controls
  const { actualLights, equipment } = separateLightsAndEquipment(lights);
  
  // Build a map of roomId to virtual room (if it exists)
  const roomToVirtualRoomMap = new Map<string, { id: string; name: string }>();
  virtualRooms.forEach(virtualRoom => {
    virtualRoom.sourceRoomIds.forEach(sourceRoomId => {
      roomToVirtualRoomMap.set(sourceRoomId, { id: virtualRoom.id, name: virtualRoom.name });
    });
  });
  
  // Build a map of roomId to area name for sorting
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Group lights by roomId (or virtual room if applicable)
  const roomGroups = new Map<string, { roomId: string; roomName: string; lights: Light[]; equipment: Light[] }>();
  
  for (const light of actualLights) {
    if (!light.roomId) continue;
    
    // Check if this room is part of a virtual room
    const virtualRoom = roomToVirtualRoomMap.get(light.roomId);
    const displayRoomId = virtualRoom ? virtualRoom.id : light.roomId;
    const displayRoomName = virtualRoom ? virtualRoom.name : (rooms.find(r => r.id === light.roomId)?.name || `Room ${light.roomId}`);
    
    const existing = roomGroups.get(displayRoomId);
    if (existing) {
      existing.lights.push(light);
    } else {
      roomGroups.set(displayRoomId, {
        roomId: displayRoomId,
        roomName: displayRoomName,
        lights: [light],
        equipment: [],
      });
    }
  }
  
  // Group equipment by roomId (or virtual room if applicable)
  for (const equip of equipment) {
    if (!equip.roomId) continue;
    
    // Check if this room is part of a virtual room
    const virtualRoom = roomToVirtualRoomMap.get(equip.roomId);
    const displayRoomId = virtualRoom ? virtualRoom.id : equip.roomId;
    const displayRoomName = virtualRoom ? virtualRoom.name : (rooms.find(r => r.id === equip.roomId)?.name || `Room ${equip.roomId}`);
    
    const existing = roomGroups.get(displayRoomId);
    if (existing) {
      existing.equipment.push(equip);
    } else {
      // Create a new room group even if it only has equipment (no lights)
      roomGroups.set(displayRoomId, {
        roomId: displayRoomId,
        roomName: displayRoomName,
        lights: [],
        equipment: [equip],
      });
    }
  }
  
  // Convert to LightingRoomGroup format
  const groups: LightingRoomGroup[] = [];
  
  for (const group of roomGroups.values()) {
    const lightsOn = group.lights.filter(l => l.isOn || l.level > 0).length;
    const avgBrightness = group.lights.length > 0
      ? Math.round((group.lights.reduce((sum, l) => sum + Math.round((l.level / 65535) * 100), 0) / group.lights.length))
      : 0;
    
    groups.push({
      roomId: group.roomId,
      roomName: group.roomName,
      lights: group.lights,
      lightsOn,
      totalLights: group.lights.length,
      avgBrightness,
      equipment: group.equipment,
    });
  }
  
  // Sort by area order (same as "By Zone" view), then by room name
  groups.sort((a, b) => {
    const areaA = roomToAreaMap.get(a.roomId) || '';
    const areaB = roomToAreaMap.get(b.roomId) || '';
    const orderA = getZoneOrder(areaA);
    const orderB = getZoneOrder(areaB);
    if (orderA !== orderB) return orderA - orderB;
    // Secondary sort by room name
    return a.roomName.localeCompare(b.roomName);
  });
  
  return groups;
}

// Room status interface for Home page tiles
export interface RoomStatus {
  room: Room;
  lightingStatus: {
    lightsOn: number;
    totalLights: number;
    avgBrightness: number;
  } | null;
  climateStatus: {
    currentTemp: number;
    setPoint: number;
    mode: string;
    isFloorHeatOnly: boolean;  // True if room only has floor heat thermostat (no main thermostat)
  } | null;
  mediaStatus: {
    isPoweredOn: boolean;
    currentSourceName: string | null;
    isVideo: boolean;
  } | null;
}

// Helper to detect if a source is video-based from its name
function isVideoSource(sourceName: string | undefined): boolean {
  if (!sourceName) return false;
  
  const videoKeywords = [
    'tv', 'apple tv', 'roku', 'firestick', 'fire stick', 'chromecast',
    'hdmi', 'video', 'nvr', 'camera', 'dvr', 'cable', 'satellite',
    'dish', 'directv', 'xfinity', 'projector', 'bluray', 'blu-ray',
    'dvd', 'gaming', 'xbox', 'playstation', 'nintendo', 'switch',
    'screen', 'display', 'monitor'
  ];
  
  const lowerName = sourceName.toLowerCase();
  return videoKeywords.some(keyword => lowerName.includes(keyword));
}

// Get all rooms with combined lighting and climate status (includes virtual rooms)
export function getRoomsWithStatus(): RoomStatus[] {
  const { rooms, lights, thermostats, areas, virtualRooms, mediaRooms } = useDeviceStore.getState();
  
  // Filter out equipment controls
  const { actualLights } = separateLightsAndEquipment(lights);
  
  // Build a map of roomId to area name for sorting
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Get lighting groups by room
  const lightingGroups = getLightingRoomGroups();
  const lightingMap = new Map<string, typeof lightingGroups[0]>();
  lightingGroups.forEach(group => {
    lightingMap.set(group.roomId, group);
  });
  
  // Get thermostat pairs by room
  const thermostatPairs = getThermostatPairs();
  const thermostatMap = new Map<string, typeof thermostatPairs[0]>();
  thermostatPairs.forEach(pair => {
    thermostatMap.set(pair.roomId, pair);
  });
  
  // Build a map of roomId to media room
  const mediaRoomMap = new Map<string, typeof mediaRooms[0]>();
  mediaRooms.forEach(mediaRoom => {
    if (mediaRoom.roomId) {
      mediaRoomMap.set(mediaRoom.roomId, mediaRoom);
    }
  });
  
  // Combine data for each regular room
  const roomStatuses: RoomStatus[] = rooms.map(room => {
    const lightingGroup = lightingMap.get(room.id);
    const thermostatPair = thermostatMap.get(room.id);
    const mediaRoom = mediaRoomMap.get(room.id);
    
    const lightingStatus = lightingGroup ? {
      lightsOn: lightingGroup.lightsOn,
      totalLights: lightingGroup.totalLights,
      avgBrightness: lightingGroup.avgBrightness,
    } : null;
    
    // Check if this room only has a floor heat thermostat (no main thermostat)
    // This happens when the pair has no floorHeat and the mainThermostat IS a floor heat unit
    const isFloorHeatOnly = thermostatPair ? (
      thermostatPair.floorHeat === null && isFloorHeat(thermostatPair.mainThermostat)
    ) : false;
    
    const climateStatus = thermostatPair ? {
      currentTemp: thermostatPair.mainThermostat.currentTemp,
      setPoint: thermostatPair.mainThermostat.mode === "heat"
        ? thermostatPair.mainThermostat.heatSetPoint
        : thermostatPair.mainThermostat.mode === "cool"
          ? thermostatPair.mainThermostat.coolSetPoint
          : thermostatPair.mainThermostat.heatSetPoint,
      mode: thermostatPair.mainThermostat.mode || "off",
      isFloorHeatOnly,
    } : null;
    
    const mediaStatus = mediaRoom ? {
      isPoweredOn: mediaRoom.isPoweredOn,
      currentSourceName: mediaRoom.currentSourceName || null,
      isVideo: isVideoSource(mediaRoom.currentSourceName),
    } : null;
    
    return {
      room,
      lightingStatus,
      climateStatus,
      mediaStatus,
    };
  });
  
  // Add virtual rooms
  const virtualRoomStatuses: RoomStatus[] = virtualRooms.map(virtualRoom => {
    // Aggregate lighting status from all source rooms
    let totalLights = 0;
    let lightsOn = 0;
    let totalBrightness = 0;
    
    virtualRoom.sourceRoomIds.forEach(roomId => {
      const lightingGroup = lightingMap.get(roomId);
      if (lightingGroup) {
        totalLights += lightingGroup.totalLights;
        lightsOn += lightingGroup.lightsOn;
        totalBrightness += lightingGroup.avgBrightness * lightingGroup.totalLights;
      }
    });
    
    const lightingStatus = totalLights > 0 ? {
      lightsOn,
      totalLights,
      avgBrightness: Math.round(totalBrightness / totalLights),
    } : null;
    
    // Aggregate climate status from all source rooms (exclude floor-heat-only rooms)
    const sourceTemps: number[] = [];
    const sourceSetPoints: number[] = [];
    let hasActiveClimate = false;
    
    virtualRoom.sourceRoomIds.forEach(roomId => {
      const thermostatPair = thermostatMap.get(roomId);
      if (thermostatPair) {
        // Skip floor-heat-only rooms (no main thermostat, only floor heat)
        const isFloorHeatOnlyRoom = thermostatPair.floorHeat === null && isFloorHeat(thermostatPair.mainThermostat);
        if (isFloorHeatOnlyRoom) return;
        
        sourceTemps.push(thermostatPair.mainThermostat.currentTemp);
        const setPoint = thermostatPair.mainThermostat.mode === "heat"
          ? thermostatPair.mainThermostat.heatSetPoint
          : thermostatPair.mainThermostat.mode === "cool"
            ? thermostatPair.mainThermostat.coolSetPoint
            : thermostatPair.mainThermostat.heatSetPoint;
        sourceSetPoints.push(setPoint);
        if (thermostatPair.mainThermostat.mode && thermostatPair.mainThermostat.mode !== "off") {
          hasActiveClimate = true;
        }
      }
    });
    
    const climateStatus = sourceTemps.length > 0 ? {
      currentTemp: Math.round(sourceTemps.reduce((sum, t) => sum + t, 0) / sourceTemps.length),
      setPoint: Math.round(sourceSetPoints.reduce((sum, t) => sum + t, 0) / sourceSetPoints.length),
      mode: hasActiveClimate ? "auto" : "off",
      isFloorHeatOnly: false, // Virtual rooms aggregate multiple sources, so not floor-heat-only
    } : null;
    
    // Aggregate media status from all source rooms
    let hasMediaOn = false;
    let activeSourceName: string | null = null;
    let hasVideo = false;
    
    virtualRoom.sourceRoomIds.forEach(roomId => {
      const mediaRoom = mediaRoomMap.get(roomId);
      if (mediaRoom) {
        if (mediaRoom.isPoweredOn) {
          hasMediaOn = true;
          if (!activeSourceName && mediaRoom.currentSourceName) {
            activeSourceName = mediaRoom.currentSourceName;
            hasVideo = isVideoSource(mediaRoom.currentSourceName);
          }
        }
      }
    });
    
    // Check if any source room has a media room
    const hasAnyMedia = virtualRoom.sourceRoomIds.some(roomId => mediaRoomMap.has(roomId));
    
    const mediaStatus = hasAnyMedia ? {
      isPoweredOn: hasMediaOn,
      currentSourceName: activeSourceName,
      isVideo: hasVideo,
    } : null;
    
    // Create a virtual Room object for the virtual room
    const virtualRoomObj: Room = {
      id: virtualRoom.id,
      name: virtualRoom.name,
      areaId: virtualRoom.areaId,
      areaName: virtualRoom.areaName,
    };
    
    return {
      room: virtualRoomObj,
      lightingStatus,
      climateStatus,
      mediaStatus,
    };
  });
  
  // Combine regular rooms and virtual rooms
  const allRoomStatuses = [...roomStatuses, ...virtualRoomStatuses];
  
  // Filter to only rooms with at least lights or climate, then sort
  return allRoomStatuses
    .filter(rs => rs.lightingStatus !== null || rs.climateStatus !== null)
    .sort((a, b) => {
      // Virtual rooms go first
      const aIsVirtual = a.room.id.startsWith("virtual-");
      const bIsVirtual = b.room.id.startsWith("virtual-");
      if (aIsVirtual && !bIsVirtual) return -1;
      if (!aIsVirtual && bIsVirtual) return 1;
      
      // Then sort by area
      const areaA = roomToAreaMap.get(a.room.id) || '';
      const areaB = roomToAreaMap.get(b.room.id) || '';
      const orderA = getZoneOrder(areaA);
      const orderB = getZoneOrder(areaB);
      if (orderA !== orderB) return orderA - orderB;
      
      // Finally by room name
      return a.room.name.localeCompare(b.room.name);
    });
}

// Room zone interface for grouping rooms by area
export interface RoomZoneWithData {
  zone: {
    id: string;
    name: string;
  };
  rooms: RoomStatus[];
  totalRooms: number;
  // Lighting stats
  totalLights: number;
  lightsOn: number;
  avgBrightness: number;
  // Climate stats
  avgCurrentTemp: number;
  avgSetPoint: number;
  activeThermostats: number;
  // Media stats
  totalMediaRooms: number;
  mediaRoomsOn: number;
  activeMediaSource: string | null;
}

// Get rooms grouped by zone/area with combined lighting and climate data
export function getRoomZonesWithData(): RoomZoneWithData[] {
  const { areas, rooms } = useDeviceStore.getState();
  const roomStatuses = getRoomsWithStatus();
  
  // Build a map of roomId to area name
  const roomToAreaMap = new Map<string, string>();
  areas.forEach(area => {
    area.roomIds.forEach(roomId => {
      roomToAreaMap.set(roomId, area.name);
    });
  });
  
  // Create "Whole House" zone (always first)
  const wholeHouseRooms = roomStatuses;
  const wholeHouseTotalLights = wholeHouseRooms.reduce((sum, rs) => sum + (rs.lightingStatus?.totalLights || 0), 0);
  const wholeHouseLightsOn = wholeHouseRooms.reduce((sum, rs) => sum + (rs.lightingStatus?.lightsOn || 0), 0);
  const wholeHouseAvgBrightness = wholeHouseRooms
    .filter(rs => rs.lightingStatus && rs.lightingStatus.totalLights > 0)
    .reduce((sum, rs) => {
      const weightedBrightness = (rs.lightingStatus!.avgBrightness * rs.lightingStatus!.totalLights);
      return sum + weightedBrightness;
    }, 0) / (wholeHouseTotalLights || 1);
  
  // Filter out floor-heat-only rooms when calculating average temperatures
  const wholeHouseMainClimateRooms = wholeHouseRooms.filter(rs => 
    rs.climateStatus !== null && !rs.climateStatus.isFloorHeatOnly
  );
  const wholeHouseTemps = wholeHouseMainClimateRooms.map(rs => rs.climateStatus!.currentTemp);
  const wholeHouseAvgTemp = wholeHouseTemps.length > 0
    ? Math.round(wholeHouseTemps.reduce((sum, t) => sum + t, 0) / wholeHouseTemps.length)
    : 0;
  
  const wholeHouseSetPoints = wholeHouseMainClimateRooms.map(rs => rs.climateStatus!.setPoint);
  const wholeHouseAvgSetPoint = wholeHouseSetPoints.length > 0
    ? Math.round(wholeHouseSetPoints.reduce((sum, t) => sum + t, 0) / wholeHouseSetPoints.length)
    : 0;
  
  const wholeHouseActiveThermostats = wholeHouseMainClimateRooms.filter(rs => 
    rs.climateStatus!.mode !== "off"
  ).length;
  
  // Media stats for Whole House
  const wholeHouseTotalMedia = wholeHouseRooms.filter(rs => rs.mediaStatus !== null).length;
  const wholeHouseMediaOn = wholeHouseRooms.filter(rs => rs.mediaStatus?.isPoweredOn).length;
  const wholeHouseActiveSource = wholeHouseRooms.find(rs => rs.mediaStatus?.isPoweredOn && rs.mediaStatus?.currentSourceName)?.mediaStatus?.currentSourceName || null;
  
  const wholeHouseZone: RoomZoneWithData = {
    zone: {
      id: "whole-house",
      name: "Whole House",
    },
    rooms: wholeHouseRooms,
    totalRooms: wholeHouseRooms.length,
    totalLights: wholeHouseTotalLights,
    lightsOn: wholeHouseLightsOn,
    avgBrightness: Math.round(wholeHouseAvgBrightness),
    avgCurrentTemp: wholeHouseAvgTemp,
    avgSetPoint: wholeHouseAvgSetPoint,
    activeThermostats: wholeHouseActiveThermostats,
    totalMediaRooms: wholeHouseTotalMedia,
    mediaRoomsOn: wholeHouseMediaOn,
    activeMediaSource: wholeHouseActiveSource,
  };
  
  // Create area-based zones
  const areaZones: RoomZoneWithData[] = areas.map(area => {
    const zoneRooms = roomStatuses.filter(rs => 
      roomToAreaMap.get(rs.room.id) === area.name
    );
    
    const zoneTotalLights = zoneRooms.reduce((sum, rs) => sum + (rs.lightingStatus?.totalLights || 0), 0);
    const zoneLightsOn = zoneRooms.reduce((sum, rs) => sum + (rs.lightingStatus?.lightsOn || 0), 0);
    const zoneAvgBrightness = zoneRooms
      .filter(rs => rs.lightingStatus && rs.lightingStatus.totalLights > 0)
      .reduce((sum, rs) => {
        const weightedBrightness = (rs.lightingStatus!.avgBrightness * rs.lightingStatus!.totalLights);
        return sum + weightedBrightness;
      }, 0) / (zoneTotalLights || 1);
    
    // Filter out floor-heat-only rooms when calculating average temperatures
    const zoneMainClimateRooms = zoneRooms.filter(rs => 
      rs.climateStatus !== null && !rs.climateStatus.isFloorHeatOnly
    );
    const zoneTemps = zoneMainClimateRooms.map(rs => rs.climateStatus!.currentTemp);
    const zoneAvgTemp = zoneTemps.length > 0
      ? Math.round(zoneTemps.reduce((sum, t) => sum + t, 0) / zoneTemps.length)
      : 0;
    
    const zoneSetPoints = zoneMainClimateRooms.map(rs => rs.climateStatus!.setPoint);
    const zoneAvgSetPoint = zoneSetPoints.length > 0
      ? Math.round(zoneSetPoints.reduce((sum, t) => sum + t, 0) / zoneSetPoints.length)
      : 0;
    
    const zoneActiveThermostats = zoneMainClimateRooms.filter(rs => 
      rs.climateStatus!.mode !== "off"
    ).length;
    
    // Media stats
    const zoneTotalMedia = zoneRooms.filter(rs => rs.mediaStatus !== null).length;
    const zoneMediaOn = zoneRooms.filter(rs => rs.mediaStatus?.isPoweredOn).length;
    const zoneActiveSource = zoneRooms.find(rs => rs.mediaStatus?.isPoweredOn && rs.mediaStatus?.currentSourceName)?.mediaStatus?.currentSourceName || null;
    
    return {
      zone: {
        id: area.id,
        name: area.name,
      },
      rooms: zoneRooms,
      totalRooms: zoneRooms.length,
      totalLights: zoneTotalLights,
      lightsOn: zoneLightsOn,
      avgBrightness: Math.round(zoneAvgBrightness),
      avgCurrentTemp: zoneAvgTemp,
      avgSetPoint: zoneAvgSetPoint,
      activeThermostats: zoneActiveThermostats,
      totalMediaRooms: zoneTotalMedia,
      mediaRoomsOn: zoneMediaOn,
      activeMediaSource: zoneActiveSource,
    };
  }).filter(zone => zone.rooms.length > 0); // Only include zones with rooms
  
  // Sort area zones by the defined order
  areaZones.sort((a, b) => getZoneOrder(a.zone.name) - getZoneOrder(b.zone.name));
  
  return [wholeHouseZone, ...areaZones];
}

// Get favorite scenes for a specific room
export function getFavoriteScenesForRoom(roomId: string): Scene[] {
  const { scenes, favoriteSceneIds } = useDeviceStore.getState();
  
  return scenes.filter(scene => 
    scene.roomId === roomId && favoriteSceneIds.includes(scene.id)
  );
}

// Get all favorite scenes
export function getFavoriteScenes(): Scene[] {
  const { scenes, favoriteSceneIds } = useDeviceStore.getState();
  
  return scenes.filter(scene => favoriteSceneIds.includes(scene.id));
}

// =============================================================================
// Audio Zones CRUD operations
// =============================================================================

// Fetch audio zones from server
export async function fetchAudioZones() {
  const { setAudioZones, setError } = useDeviceStore.getState();
  try {
    const response = await fetch("/api/crestron/audio-zones", { cache: 'no-store' });
    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      setAudioZones(data.data);
    } else {
      setError(data.error || "Failed to fetch audio zones");
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch audio zones");
  }
}

// Create a new audio zone
export async function createAudioZone(name: string, mediaRoomIds: string[]): Promise<AudioZone | null> {
  const { setAudioZones, audioZones } = useDeviceStore.getState();
  
  try {
    const response = await fetch("/api/crestron/audio-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mediaRoomIds }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      // Add the new zone to state
      setAudioZones([...audioZones, data.data]);
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

// Update an existing audio zone
export async function updateAudioZone(
  id: string, 
  name?: string, 
  mediaRoomIds?: string[]
): Promise<AudioZone | null> {
  const { setAudioZones, audioZones } = useDeviceStore.getState();
  
  try {
    const response = await fetch("/api/crestron/audio-zones", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, mediaRoomIds }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      // Update the zone in state
      setAudioZones(audioZones.map(zone => zone.id === id ? data.data : zone));
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

// Delete an audio zone
export async function deleteAudioZone(id: string): Promise<boolean> {
  const { setAudioZones, audioZones } = useDeviceStore.getState();
  
  try {
    const response = await fetch(`/api/crestron/audio-zones?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (data.success) {
      // Remove the zone from state
      setAudioZones(audioZones.filter(zone => zone.id !== id));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Get media room zones with computed data (includes both built-in and custom zones)
export function getMediaRoomZonesWithCustom(): MediaRoomZoneWithData[] {
  const { mediaRooms, audioZones, areas, rooms } = useDeviceStore.getState();
  
  if (mediaRooms.length === 0) return [];
  
  // First, get the built-in zones (from getMediaRoomZonesWithData)
  const builtInZones = getMediaRoomZonesWithData();
  
  // Then add custom zones
  const customZones: MediaRoomZoneWithData[] = audioZones
    .filter(zone => !zone.isBuiltIn)
    .map(zone => {
      const zoneMediaRooms = mediaRooms.filter(m => 
        zone.mediaRoomIds.includes(m.id)
      );
      
      const playingRooms = zoneMediaRooms.filter(m => m.isPoweredOn);
      const avgVolume = playingRooms.length > 0
        ? Math.round(playingRooms.reduce((sum, m) => sum + m.volumePercent, 0) / playingRooms.length)
        : 0;
      
      return {
        zone: { id: zone.id, name: zone.name },
        mediaRooms: zoneMediaRooms,
        totalRooms: zoneMediaRooms.length,
        playingCount: playingRooms.length,
        avgVolume,
      };
    })
    .filter(zone => zone.mediaRooms.length > 0); // Only include zones with rooms
  
  // Combine: Whole House first, then custom zones, then area zones
  const wholeHouse = builtInZones.find(z => z.zone.id === "whole-house");
  const areaZones = builtInZones.filter(z => z.zone.id !== "whole-house");
  
  return [
    ...(wholeHouse ? [wholeHouse] : []),
    ...customZones,
    ...areaZones,
  ];
}
