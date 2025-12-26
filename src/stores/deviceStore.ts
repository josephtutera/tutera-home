"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Room,
  MergedRoom,
  Light,
  Shade,
  Scene,
  Thermostat,
  DoorLock,
  Sensor,
  SecurityDevice,
  MediaRoom,
  QuickAction,
} from "@/lib/crestron/types";
import { useAuthStore, refreshAuth } from "./authStore";

interface DeviceState {
  // Data
  rooms: Room[];
  mergedRooms: MergedRoom[];
  lights: Light[];
  shades: Shade[];
  scenes: Scene[];
  thermostats: Thermostat[];
  doorLocks: DoorLock[];
  sensors: Sensor[];
  securityDevices: SecurityDevice[];
  mediaRooms: MediaRoom[];
  quickActions: QuickAction[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  setRooms: (rooms: Room[]) => void;
  setMergedRooms: (mergedRooms: MergedRoom[]) => void;
  setLights: (lights: Light[]) => void;
  setShades: (shades: Shade[]) => void;
  setScenes: (scenes: Scene[]) => void;
  setThermostats: (thermostats: Thermostat[]) => void;
  setDoorLocks: (doorLocks: DoorLock[]) => void;
  setSensors: (sensors: Sensor[]) => void;
  setSecurityDevices: (securityDevices: SecurityDevice[]) => void;
  setMediaRooms: (mediaRooms: MediaRoom[]) => void;
  setQuickActions: (quickActions: QuickAction[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdated: (date: Date) => void;
  
  // Optimistic update helpers
  updateLight: (id: string, updates: Partial<Light>) => void;
  updateThermostat: (id: string, updates: Partial<Thermostat>) => void;
  updateDoorLock: (id: string, updates: Partial<DoorLock>) => void;
  
  // Clear all data
  clearAll: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      rooms: [],
      mergedRooms: [],
      lights: [],
      shades: [],
      scenes: [],
      thermostats: [],
      doorLocks: [],
      sensors: [],
      securityDevices: [],
      mediaRooms: [],
      quickActions: [],
      isLoading: false,
      error: null,
      lastUpdated: null,

      setRooms: (rooms) => set({ rooms }),
      setMergedRooms: (mergedRooms) => set({ mergedRooms }),
      setLights: (lights) => set({ lights }),
      setShades: (shades) => set({ shades }),
      setScenes: (scenes) => set({ scenes }),
      setThermostats: (thermostats) => set({ thermostats }),
      setDoorLocks: (doorLocks) => set({ doorLocks }),
      setSensors: (sensors) => set({ sensors }),
      setSecurityDevices: (securityDevices) => set({ securityDevices }),
      setMediaRooms: (mediaRooms) => set({ mediaRooms }),
      setQuickActions: (quickActions) => set({ quickActions }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setLastUpdated: (date) => set({ lastUpdated: date }),

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

      clearAll: () =>
        set({
          rooms: [],
          mergedRooms: [],
          lights: [],
          shades: [],
          scenes: [],
          thermostats: [],
          doorLocks: [],
          sensors: [],
          securityDevices: [],
          mediaRooms: [],
          quickActions: [],
          isLoading: false,
          error: null,
          lastUpdated: null,
        }),
    }),
    {
      name: "crestron-devices",
      // Persist all device data so it's available immediately on page load
      partialize: (state) => ({
        rooms: state.rooms,
        lights: state.lights,
        shades: state.shades,
        scenes: state.scenes,
        thermostats: state.thermostats,
        doorLocks: state.doorLocks,
        sensors: state.sensors,
        securityDevices: state.securityDevices,
        mediaRooms: state.mediaRooms,
        quickActions: state.quickActions,
        lastUpdated: state.lastUpdated,
        // Don't persist isLoading or error - these should be transient
      }),
    }
  )
);

// Fetch helpers
async function fetchWithAuth(endpoint: string) {
  const headers = useAuthStore.getState().getAuthHeaders();
  const response = await fetch(`/api/crestron/${endpoint}`, { headers });
  return response.json();
}

// Track if we're already attempting to refresh auth to prevent loops
let isRefreshingAuth = false;

// Fetch all data (rooms, devices, scenes) - used by DataProvider for polling
export async function fetchAllData(isRetryAfterRefresh = false) {
  const store = useDeviceStore.getState();
  
  // Skip if already loading to prevent overlap
  if (store.isLoading) {
    return;
  }
  
  store.setLoading(true);
  store.setError(null);
  
  try {
    // Fetch all data in parallel (including merged rooms from server)
    const [roomsData, devicesData, scenesData, mergedRoomsData] = await Promise.all([
      fetchWithAuth("rooms"),
      fetchWithAuth("devices"),
      fetchWithAuth("scenes"),
      fetch("/api/crestron/merged-rooms").then(res => res.json()),
    ]);
    
    // Check if all responses indicate potential auth failure (empty data or errors)
    const roomsArray = roomsData.success 
      ? (Array.isArray(roomsData.data) ? roomsData.data : roomsData.data?.rooms || [])
      : [];
    const lightsArray = devicesData.success && devicesData.data?.lights || [];
    const scenesArray = scenesData.success ? (Array.isArray(scenesData.data) ? scenesData.data : []) : [];
    
    // Detect auth failure: if we get empty data from ALL endpoints, auth likely expired
    const allEmpty = roomsArray.length === 0 && lightsArray.length === 0 && scenesArray.length === 0;
    
    // If all data is empty and we haven't already tried refreshing, attempt to refresh auth
    if (allEmpty && !isRetryAfterRefresh && !isRefreshingAuth) {
      isRefreshingAuth = true;
      store.setLoading(false); // Release loading lock for refresh
      
      const refreshSuccess = await refreshAuth();
      isRefreshingAuth = false;
      
      if (refreshSuccess) {
        // Retry fetch with new auth
        return fetchAllData(true);
      } else {
        store.setError("Session expired. Please log in again.");
        return;
      }
    }
    
    // Process rooms - only update if we got actual data
    // Transform room IDs to strings to match how device roomId fields are stored
    if (roomsData.success && roomsArray.length > 0) {
      const transformedRooms = roomsArray.map((room: { id: string | number; name: string }) => ({
        ...room,
        id: String(room.id),
      }));
      store.setRooms(transformedRooms);
    }
    
    // Process devices - only update if we got actual data (don't overwrite with empty)
    if (devicesData.success && devicesData.data) {
      // Only update each device type if we got non-empty data (preserve existing data on partial failures)
      if (devicesData.data.lights?.length > 0) {
        store.setLights(devicesData.data.lights);
      }
      if (devicesData.data.shades?.length > 0) {
        store.setShades(devicesData.data.shades);
      }
      if (devicesData.data.thermostats?.length > 0) {
        store.setThermostats(devicesData.data.thermostats);
      }
      if (devicesData.data.doorLocks?.length > 0) {
        store.setDoorLocks(devicesData.data.doorLocks);
      }
      if (devicesData.data.sensors?.length > 0) {
        store.setSensors(devicesData.data.sensors);
      }
      if (devicesData.data.securityDevices?.length > 0) {
        store.setSecurityDevices(devicesData.data.securityDevices);
      }
      if (devicesData.data.mediaRooms?.length > 0) {
        store.setMediaRooms(devicesData.data.mediaRooms);
      }
    }
    
    // Process scenes - only update if we got actual data
    if (scenesData.success && scenesArray.length > 0) {
      store.setScenes(scenesArray);
    }
    
    // Process merged rooms from server
    if (mergedRoomsData.success && Array.isArray(mergedRoomsData.data)) {
      store.setMergedRooms(mergedRoomsData.data);
    }
    
    // Update timestamp on success
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
    store.setLoading(false);
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
  const headers = useAuthStore.getState().getAuthHeaders();
  const { updateThermostat } = useDeviceStore.getState();
  
  // Optimistic update
  updateThermostat(id, { 
    ...(heatSetPoint !== undefined && { heatSetPoint }),
    ...(coolSetPoint !== undefined && { coolSetPoint }),
  });
  
  try {
    const response = await fetch("/api/crestron/thermostats", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "setPoint", heatSetPoint, coolSetPoint }),
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

// Merged Rooms CRUD operations

export async function fetchMergedRooms() {
  const { setMergedRooms, setError } = useDeviceStore.getState();
  try {
    const response = await fetch("/api/crestron/merged-rooms");
    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      setMergedRooms(data.data);
    } else {
      setError(data.error || "Failed to fetch merged rooms");
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to fetch merged rooms");
  }
}

export async function createMergedRoom(name: string, sourceRoomIds: string[]) {
  const { setMergedRooms, mergedRooms } = useDeviceStore.getState();
  
  try {
    const response = await fetch("/api/crestron/merged-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceRoomIds }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      // Add the new merged room to state
      setMergedRooms([...mergedRooms, data.data]);
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateMergedRoom(id: string, name?: string, sourceRoomIds?: string[]) {
  const { setMergedRooms, mergedRooms } = useDeviceStore.getState();
  
  try {
    const response = await fetch("/api/crestron/merged-rooms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, sourceRoomIds }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      // Update the merged room in state
      setMergedRooms(mergedRooms.map(room => room.id === id ? data.data : room));
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteMergedRoom(id: string) {
  const { setMergedRooms, mergedRooms } = useDeviceStore.getState();
  
  try {
    const response = await fetch(`/api/crestron/merged-rooms?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (data.success) {
      // Remove the merged room from state
      setMergedRooms(mergedRooms.filter(room => room.id !== id));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
