"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Lightbulb, Blinds, Layers, Power } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { LightCard, LightGroupControl, levelToPercent, percentToLevel } from "@/components/devices/LightCard";
import { setLightState } from "@/stores/deviceStore";
import { Card } from "@/components/ui/Card";

// Helper to get/set last brightness level from localStorage
const LAST_BRIGHTNESS_KEY = "tutera-last-brightness";
function getLastBrightness(lightId: string): number | null {
  try {
    const stored = localStorage.getItem(LAST_BRIGHTNESS_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data[lightId] || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function setLastBrightness(lightId: string, brightness: number): void {
  try {
    const stored = localStorage.getItem(LAST_BRIGHTNESS_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[lightId] = brightness;
    localStorage.setItem(LAST_BRIGHTNESS_KEY, JSON.stringify(data));
  } catch {
    // Ignore errors
  }
}
import { ShadeCard } from "@/components/devices/ShadeCard";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import { SensorCard } from "@/components/devices/SensorCard";
import { EquipmentCard } from "@/components/devices/EquipmentCard";
import { Button } from "@/components/ui/Button";
import { separateLightsAndEquipment } from "@/lib/crestron/types";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData } from "@/stores/deviceStore";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  
  const { isConnected } = useAuthStore();
  const { rooms, virtualRooms, lights, shades, thermostats, sensors, isLoading } = useDeviceStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if this is a virtual room
  const isVirtualRoom = roomId.startsWith("virtual-");
  const virtualRoom = isVirtualRoom ? virtualRooms.find(vr => vr.id === roomId) : null;
  
  // Find current room (either regular or virtual)
  const room = isVirtualRoom 
    ? (virtualRoom ? { id: virtualRoom.id, name: virtualRoom.name, areaId: virtualRoom.areaId, areaName: virtualRoom.areaName } : null)
    : rooms.find(r => r.id === roomId);
  
  // Get the room IDs to filter devices by
  const targetRoomIds = isVirtualRoom && virtualRoom
    ? virtualRoom.sourceRoomIds
    : [roomId];
  
  // Filter devices by room(s)
  const allRoomLights = lights.filter(l => l.roomId && targetRoomIds.includes(l.roomId));
  const roomShades = shades.filter(s => s.roomId && targetRoomIds.includes(s.roomId));
  const roomThermostats = thermostats.filter(t => t.roomId && targetRoomIds.includes(t.roomId));
  const roomSensors = sensors.filter(s => s.roomId && targetRoomIds.includes(s.roomId));

  // Separate actual lights from equipment controls (Fan, Fountain, Heater, etc.)
  const { actualLights: roomLights, equipment: roomEquipment } = useMemo(
    () => separateLightsAndEquipment(allRoomLights),
    [allRoomLights]
  );

  // Calculate lighting stats for room header
  const lightingStats = useMemo(() => {
    const totalLights = roomLights.length;
    const lightsOn = roomLights.filter(l => l.isOn || l.level > 0).length;
    const avgBrightness = totalLights > 0
      ? Math.round(roomLights.reduce((sum, l) => sum + levelToPercent(l.level), 0) / totalLights)
      : 0;
    return { totalLights, lightsOn, avgBrightness };
  }, [roomLights]);

  const [isUpdatingLights, setIsUpdatingLights] = useState(false);
  const isLightsOn = lightingStats.lightsOn > 0;
  const buttonDisabled = isUpdatingLights || roomLights.length === 0;

  // Handle room toggle - save/restore individual light brightness levels
  const handleRoomToggle = useCallback(async (e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isUpdatingLights || roomLights.length === 0) return;
    
    setIsUpdatingLights(true);
    
    try {
      if (isLightsOn) {
        // Turning off: save each light's current brightness
        const promises = roomLights.map(async (light) => {
          const percent = levelToPercent(light.level);
          if (percent > 0) {
            setLastBrightness(light.id, percent);
          }
          return setLightState(light.id, 0, false);
        });
        await Promise.all(promises);
      } else {
        // Turning on: restore each light to its last brightness (or 75% default)
        const promises = roomLights.map(async (light) => {
          const lastBrightness = getLastBrightness(light.id);
          const targetPercent = lastBrightness !== null ? lastBrightness : 75;
          const targetLevel = percentToLevel(targetPercent);
          return setLightState(light.id, targetLevel, true);
        });
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error toggling room lights:', error);
    } finally {
      setIsUpdatingLights(false);
    }
  }, [isLightsOn, roomLights, isUpdatingLights]);

  // Handle icon click toggle
  const handleIconClick = useCallback(async (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (buttonDisabled) return;
    await handleRoomToggle(e);
  }, [handleRoomToggle, buttonDisabled]);

  // Handle pointer events on icon to prevent swipe
  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);
  
  // Get source room names for display (for virtual rooms)
  const sourceRoomNames = isVirtualRoom && virtualRoom
    ? virtualRoom.sourceRoomIds
        .map(id => rooms.find(r => r.id === id)?.name)
        .filter(Boolean)
        .join(" + ")
    : null;

  // Create room ID to name lookup for virtual room views
  const roomNameMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => map.set(room.id, room.name));
    return map;
  }, [rooms]);

  // Helper to get room name by ID
  const getRoomName = (roomId: string | undefined) => roomId ? roomNameMap.get(roomId) : undefined;

  // Group devices by source room for virtual views
  const devicesByRoom = useMemo(() => {
    if (!isVirtualRoom || !virtualRoom) return null;

    // Get unique room IDs from all devices
    const roomIds = new Set<string>();
    [...roomLights, ...roomEquipment, ...roomShades, ...roomThermostats, ...roomSensors].forEach(device => {
      if (device.roomId) roomIds.add(device.roomId);
    });

    // Create groups
    return Array.from(roomIds)
      .map(roomId => ({
        roomId,
        roomName: roomNameMap.get(roomId) || roomId,
        lights: roomLights.filter(l => l.roomId === roomId),
        equipment: roomEquipment.filter(e => e.roomId === roomId),
        shades: roomShades.filter(s => s.roomId === roomId),
        thermostats: roomThermostats.filter(t => t.roomId === roomId),
        sensors: roomSensors.filter(s => s.roomId === roomId),
      }))
      .sort((a, b) => a.roomName.localeCompare(b.roomName));
  }, [isVirtualRoom, virtualRoom, roomLights, roomEquipment, roomShades, roomThermostats, roomSensors, roomNameMap]);

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  if (!isConnected) return null;

  const totalDevices = roomLights.length + roomEquipment.length + roomShades.length + roomThermostats.length + roomSensors.length;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" aria-label="Back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                {isVirtualRoom && (
                  <Layers className="w-5 h-5 text-purple-500" />
                )}
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {room?.name || "Room"}
                </h1>
              </div>
              {sourceRoomNames && (
                <p className="text-sm text-[var(--text-tertiary)]">
                  {sourceRoomNames}
                </p>
              )}
              <RefreshedAt />
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Virtual Room: Show devices grouped by source room */}
          {isVirtualRoom && devicesByRoom ? (
            devicesByRoom.map((group) => (
              <section key={group.roomId} className="space-y-6">
                {/* Room Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-light)]">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {group.roomName}
                  </h2>
                  <span className="text-sm text-[var(--text-tertiary)]">
                    {group.lights.length + group.equipment.length + group.shades.length + group.thermostats.length + group.sensors.length} devices
                  </span>
                </div>

                {/* Lights in this room */}
                {group.lights.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-[var(--light-color)]" />
                      <h3 className="text-sm font-medium text-[var(--text-secondary)]">Lights</h3>
                    </div>
                    <LightGroupControl lights={group.lights} roomName={group.roomName} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-2">
                      {group.lights.map((light) => (
                        <motion.div key={light.id} variants={itemVariants}>
                          <LightCard light={light} compact />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Equipment in this room */}
                {group.equipment.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Power className="w-4 h-4 text-[var(--accent)]" />
                      <h3 className="text-sm font-medium text-[var(--text-secondary)]">Equipment</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-2">
                      {group.equipment.map((equip) => (
                        <motion.div key={equip.id} variants={itemVariants}>
                          <EquipmentCard equipment={equip} compact />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shades in this room */}
                {group.shades.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Blinds className="w-4 h-4 text-[var(--shade-color)]" />
                      <h3 className="text-sm font-medium text-[var(--text-secondary)]">Shades</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-2">
                      {group.shades.map((shade) => (
                        <motion.div key={shade.id} variants={itemVariants}>
                          <ShadeCard shade={shade} compact />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thermostats in this room */}
                {group.thermostats.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[var(--text-secondary)]">Climate Control</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pl-2">
                      {group.thermostats.map((thermostat) => (
                        <motion.div key={thermostat.id} variants={itemVariants}>
                          <ThermostatCard thermostat={thermostat} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sensors in this room */}
                {group.sensors.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[var(--text-secondary)]">Sensors</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-2">
                      {group.sensors.map((sensor) => (
                        <motion.div key={sensor.id} variants={itemVariants}>
                          <SensorCard sensor={sensor} compact />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))
          ) : (
            /* Regular Room: Show devices by type */
            <>
              {/* Lights */}
              {roomLights.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-[var(--light-color)]" />
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      Lights
                    </h2>
                  </div>
                  
                  {/* Room Header with Toggle */}
                  <Card padding="lg" className="bg-gradient-to-br from-yellow-500/5 to-transparent relative mb-3" style={{ cursor: 'default' }}>
                    <div className="mb-4 relative" style={{ zIndex: 100, isolation: 'isolate', cursor: 'default' }}>
                      <div className="flex items-center gap-3 mb-2 relative">
                        <motion.button
                          type="button"
                          onClick={handleIconClick}
                          onPointerDown={handleIconPointerDown}
                          disabled={buttonDisabled}
                          animate={{
                            backgroundColor: isLightsOn
                              ? "rgba(252,211,77,1)"
                              : "var(--surface-hover)",
                            scale: isLightsOn ? 1 : 0.95,
                          }}
                          transition={{ duration: 0.2 }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                          title={isLightsOn ? "Click to turn all lights off" : "Click to turn all lights on"}
                          style={{ 
                            pointerEvents: 'auto', 
                            touchAction: 'manipulation',
                            cursor: 'pointer',
                          }}
                        >
                          <Lightbulb 
                            className="w-5 h-5 transition-colors duration-200 pointer-events-none" 
                            strokeWidth={2.5} 
                            stroke={isLightsOn ? "#ffffff" : "var(--text-tertiary)"} 
                            fill="none"
                            style={{ color: isLightsOn ? "#ffffff" : "var(--text-tertiary)" }}
                          />
                        </motion.button>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                            {room?.name}
                          </h3>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {lightingStats.totalLights} {lightingStats.totalLights === 1 ? 'light' : 'lights'}
                            {lightingStats.lightsOn > 0 && ` • ${lightingStats.lightsOn} on`}
                            {lightingStats.totalLights - lightingStats.lightsOn > 0 && ` • ${lightingStats.totalLights - lightingStats.lightsOn} off`}
                          </p>
                        </div>
                      </div>
                      
                      {/* Brightness indicator */}
                      {lightingStats.lightsOn > 0 && (
                        <div className="ml-[52px]">
                          <p className="text-xl font-semibold text-[var(--text-primary)]">
                            {lightingStats.avgBrightness}% avg brightness
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <div className="space-y-3">
                    <LightGroupControl lights={roomLights} roomName={room?.name} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {roomLights.map((light) => (
                        <motion.div key={light.id} variants={itemVariants}>
                          <LightCard light={light} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Equipment (Fan, Fountain, Heater, etc.) */}
              {roomEquipment.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Power className="w-5 h-5 text-[var(--accent)]" />
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      Equipment
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roomEquipment.map((equip) => (
                      <motion.div key={equip.id} variants={itemVariants}>
                        <EquipmentCard equipment={equip} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Shades */}
              {roomShades.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Blinds className="w-5 h-5 text-[var(--shade-color)]" />
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      Shades
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roomShades.map((shade) => (
                      <motion.div key={shade.id} variants={itemVariants}>
                        <ShadeCard shade={shade} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Thermostats */}
              {roomThermostats.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Climate Control
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {roomThermostats.map((thermostat) => (
                      <motion.div key={thermostat.id} variants={itemVariants}>
                        <ThermostatCard thermostat={thermostat} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sensors */}
              {roomSensors.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Sensors
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {roomSensors.map((sensor) => (
                      <motion.div key={sensor.id} variants={itemVariants}>
                        <SensorCard sensor={sensor} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Empty State */}
          {totalDevices === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-hover)] flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-8 h-8 text-[var(--text-tertiary)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                No Devices in This Room
              </h3>
              <p className="text-[var(--text-secondary)]">
                Devices assigned to this room will appear here.
              </p>
            </div>
          )}
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}
