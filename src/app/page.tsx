"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lightbulb,
  Thermometer,
  Shield,
  Blinds,
  RefreshCw,
  ChevronRight,
  CloudSun,
  Power,
  Layers,
  Building2,
  Music,
} from "lucide-react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import { LightCard, LightGroupControl } from "@/components/devices/LightCard";
import { ShadeCard } from "@/components/devices/ShadeCard";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import { SceneGrid } from "@/components/devices/SceneCard";
import { LockAllButton } from "@/components/devices/LockCard";
import { SensorSummary } from "@/components/devices/SensorCard";
import { EquipmentCard, EquipmentSummaryCard } from "@/components/devices/EquipmentCard";
import { RoomStatusTile } from "@/components/devices/RoomStatusTile";
import { RoomZoneControl } from "@/components/devices/RoomZoneControl";
import { MediaRoomCard } from "@/components/devices/MediaRoomCard";
import { separateLightsAndEquipment } from "@/lib/crestron/types";
import { QuickActionsBar } from "@/components/layout/QuickActions";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData, getRoomsWithStatus, getRoomZonesWithData } from "@/stores/deviceStore";
import { useWeatherStore, fetchWeather } from "@/stores/weatherStore";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  // Use useShallow to prevent re-renders when object references change but values are the same
  const { 
    areas,
    rooms, 
    virtualRooms,
    lights, 
    shades, 
    scenes, 
    thermostats, 
    doorLocks,
    sensors,
    mediaRooms,
    isLoading,
  } = useDeviceStore(useShallow((state) => ({
    areas: state.areas,
    rooms: state.rooms,
    virtualRooms: state.virtualRooms,
    lights: state.lights,
    shades: state.shades,
    scenes: state.scenes,
    thermostats: state.thermostats,
    doorLocks: state.doorLocks,
    sensors: state.sensors,
    mediaRooms: state.mediaRooms,
    isLoading: state.isLoading,
  })));
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [roomViewMode, setRoomViewMode] = useState<"zones" | "rooms">("zones");
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  
  const { outsideTemp } = useWeatherStore();

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather();
  }, []);

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  // Separate actual lights from equipment controls (Fan, Fountain, Heater, etc.)
  const { actualLights: filteredLights, equipment: filteredEquipment } = useMemo(
    () => separateLightsAndEquipment(lights),
    [lights]
  );
  
  // Create room ID to name lookup
  const roomNameMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => map.set(room.id, room.name));
    // Add virtual rooms to the map
    virtualRooms.forEach(virtualRoom => {
      map.set(virtualRoom.id, virtualRoom.name);
    });
    return map;
  }, [rooms, virtualRooms]);

  // Helper to get room name by ID
  const getRoomName = (roomId: string | undefined) => roomId ? roomNameMap.get(roomId) : undefined;

  // Group equipment by room
  const equipmentByRoom = useMemo(() => {
    if (filteredEquipment.length === 0) return null;
    
    const grouped = new Map<string, typeof filteredEquipment>();
    filteredEquipment.forEach(equip => {
      if (equip.roomId) {
        const existing = grouped.get(equip.roomId) || [];
        existing.push(equip);
        grouped.set(equip.roomId, existing);
      }
    });
    
    // If nothing was grouped (no room IDs), return null
    if (grouped.size === 0) return null;
    
    // Convert to array sorted by room name
    return Array.from(grouped.entries())
      .map(([roomId, equipment]) => ({
        roomId,
        roomName: roomNameMap.get(roomId) || roomId,
        equipment,
      }))
      .sort((a, b) => a.roomName.localeCompare(b.roomName));
  }, [filteredEquipment, roomNameMap]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  // Stats - separate actual lights from equipment for accurate light count
  const { actualLights: allActualLights } = useMemo(
    () => separateLightsAndEquipment(lights),
    [lights]
  );
  const lightsOn = allActualLights.filter(l => l.isOn || l.level > 0).length;
  const unlockedDoors = doorLocks.filter(l => !l.isLocked).length;
  const mediaRoomsPlaying = mediaRooms.filter(m => m.isPoweredOn).length;

  // Get rooms with combined lighting and climate status
  const roomsWithStatus = useMemo(() => getRoomsWithStatus(), [lights, thermostats, rooms]);
  
  // Get room zones with combined lighting and climate data
  const roomZones = useMemo(() => getRoomZonesWithData(), [lights, thermostats, rooms]);
  
  const handleZoneToggle = (zoneId: string) => {
    setExpandedZoneId(prev => prev === zoneId ? null : zoneId);
  };

  if (!isConnected) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Welcome Home
          </h1>
            <RefreshedAt />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Quick Stats */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          <motion.div variants={itemVariants}>
            <Card padding="md" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--light-color)]/20 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-[var(--light-color)]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{lightsOn}</p>
                <p className="text-xs text-[var(--text-secondary)]">Lights On</p>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card padding="md" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--climate-color)]/20 flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-[var(--climate-color)]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {thermostats[0]?.currentTemp || "--"}°
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Inside</p>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card padding="md" className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                unlockedDoors > 0 ? "bg-[var(--danger)]/20" : "bg-[var(--success)]/20"
              }`}>
                <Shield className={`w-5 h-5 ${
                  unlockedDoors > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
                }`} />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {unlockedDoors > 0 ? unlockedDoors : "✓"}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {unlockedDoors > 0 ? "Unlocked" : "Secured"}
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card padding="md" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                <CloudSun className="w-5 h-5 text-sky-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {outsideTemp !== null ? `${outsideTemp}°` : "--°"}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Outside</p>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Room Status Tiles */}
        {roomsWithStatus.length > 0 && (
          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mb-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Rooms
                </h2>
                <Link
                  href="/rooms/virtual"
                  className="text-sm text-[var(--accent)] hover:text-[var(--accent)]/80 hover:underline transition-colors"
                >
                  Manage Virtual Rooms
                </Link>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[var(--surface)] rounded-xl">
                <button
                  onClick={() => setRoomViewMode("zones")}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${roomViewMode === "zones"
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }
                  `}
                >
                  <Layers className="w-4 h-4" />
                  By Zone
                </button>
                <button
                  onClick={() => setRoomViewMode("rooms")}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${roomViewMode === "rooms"
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }
                  `}
                >
                  <Building2 className="w-4 h-4" />
                  By Room
                </button>
              </div>
            </div>

            {/* Zone Controls */}
            {roomViewMode === "zones" && roomZones.length > 0 && (
              <div className="space-y-4">
                {roomZones.map((zoneData, index) => (
                  <motion.div 
                    key={zoneData.zone.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    layout
                  >
                    <RoomZoneControl
                      zoneData={zoneData}
                      expanded={expandedZoneId === zoneData.zone.id}
                      onToggleExpand={() => handleZoneToggle(zoneData.zone.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Room-by-Room Tiles */}
            {roomViewMode === "rooms" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {roomsWithStatus.map((roomStatus, index) => (
                  <motion.div 
                    key={roomStatus.room.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <RoomStatusTile
                      room={roomStatus.room}
                      lightingStatus={roomStatus.lightingStatus}
                      climateStatus={roomStatus.climateStatus}
                      mediaStatus={roomStatus.mediaStatus}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}


        {/* Main Content Grid - Order: Scenes, Lighting, Climate, Media, Equipment */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Row 1: Scenes and Lighting side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scenes */}
            {scenes.length > 0 && (
              <motion.section variants={itemVariants}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Scenes
                  </h2>
                  <Link
                    href="/scenes"
                    className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <SceneGrid scenes={scenes} maxVisible={4} />
              </motion.section>
            )}

            {/* Lighting */}
            {filteredLights.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Lighting
                </h2>
                <Link href="/lighting">
                  <Card padding="md" className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--light-color)]/20 flex items-center justify-center">
                          <Lightbulb className="w-5 h-5 text-[var(--light-color)]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">
                            {filteredLights.filter(l => l.isOn || l.level > 0).length} of {filteredLights.length} lights on
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {new Set(filteredLights.filter(l => l.roomId).map(l => l.roomId)).size} rooms • {filteredLights.filter(l => l.roomId).length} assigned
                          </p>
                        </div>
                      </div>
                      <LightGroupControl lights={filteredLights} standalone={false} />
                    </div>
                  </Card>
                </Link>
              </motion.section>
            )}
          </div>

          {/* Row 2: Climate and Media side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Climate */}
            {thermostats.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Climate
                </h2>
                <Link href="/climate">
                  <div className="hover:opacity-90 transition-opacity cursor-pointer">
                    <ThermostatCard thermostat={thermostats[0]} compact />
                  </div>
                </Link>
              </motion.section>
            )}

            {/* Media */}
            {mediaRooms.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Media
                </h2>
                <Link href="/media">
                  <Card padding="md" className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
                        <Music className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{mediaRooms.length} Media Rooms</p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {mediaRoomsPlaying > 0 ? `${mediaRoomsPlaying} playing` : "All off"}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.section>
            )}
          </div>

          {/* Row 3: Equipment and Sensors & Security side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Equipment (Fan, Fountain, Heater, etc.) */}
            {filteredEquipment.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Equipment
                </h2>
                <EquipmentSummaryCard 
                  equipment={filteredEquipment} 
                  equipmentByRoom={equipmentByRoom} 
                />
              </motion.section>
            )}

            {/* Sensors and Security - Always show, clickable to navigate */}
            <motion.section variants={itemVariants}>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                Sensors and Security
              </h2>
              <Link href="/security">
                <Card padding="md" className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
                  {/* Security status row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        unlockedDoors > 0 ? "bg-[var(--danger)]/20" : "bg-[var(--success)]/20"
                      }`}>
                        <Shield className={`w-5 h-5 ${
                          unlockedDoors > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {doorLocks.length > 0 ? `${doorLocks.length} Door Locks` : "Security"}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {doorLocks.length === 0 
                            ? "No locks configured"
                            : unlockedDoors > 0 
                              ? `${unlockedDoors} unlocked` 
                              : "All locked"}
                        </p>
                      </div>
                    </div>
                    {doorLocks.length > 0 && <LockAllButton locks={doorLocks} />}
                  </div>
                  {/* Sensors summary row */}
                  {sensors.length > 0 && (
                    <div className="pt-3 border-t border-[var(--border-light)]">
                      <SensorSummary sensors={sensors} />
                    </div>
                  )}
                </Card>
              </Link>
            </motion.section>
          </div>

          {/* Row 4: Shades */}
          {shades.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Shades
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shades.slice(0, 4).map((shade) => (
                    <ShadeCard key={shade.id} shade={shade} compact roomName={getRoomName(shade.roomId)} />
                  ))}
                </div>
              </motion.section>
            </div>
          )}
        </motion.div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-[var(--accent)] animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">Loading devices...</p>
            </div>
          </div>
        )}
      </main>

      <QuickActionsBar />
      <BottomNavigation />
    </div>
  );
}
