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
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNavigation, RoomTabs } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import { LightCard, LightGroupControl } from "@/components/devices/LightCard";
import { LightsByRoom } from "@/components/devices/LightsByRoom";
import { ShadeCard } from "@/components/devices/ShadeCard";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import { SceneGrid } from "@/components/devices/SceneCard";
import { LockAllButton } from "@/components/devices/LockCard";
import { SensorSummary } from "@/components/devices/SensorCard";
import { EquipmentCard } from "@/components/devices/EquipmentCard";
import { MergeRoomsModal } from "@/components/devices/MergeRoomsModal";
import { RoomStatusTile } from "@/components/devices/RoomStatusTile";
import { RoomZoneControl } from "@/components/devices/RoomZoneControl";
import { separateLightsAndEquipment } from "@/lib/crestron/types";
import { QuickActionsBar } from "@/components/layout/QuickActions";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData, moveRoomToArea, createArea, getRoomsWithStatus, getRoomZonesWithData } from "@/stores/deviceStore";
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
  const { 
    areas,
    rooms, 
    mergedRooms,
    lights, 
    shades, 
    scenes, 
    thermostats, 
    doorLocks,
    sensors,
    isLoading,
  } = useDeviceStore();
  
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [roomViewMode, setRoomViewMode] = useState<"zones" | "rooms">("zones");
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>("whole-house");
  
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

  // Check if selected room is a merged room
  const isMergedRoom = selectedRoom?.startsWith("merged-");
  const selectedMergedRoom = isMergedRoom 
    ? mergedRooms.find(mr => mr.id === selectedRoom) 
    : null;
  
  // Get target room IDs for filtering (supports merged rooms)
  const targetRoomIds = useMemo(() => 
    isMergedRoom && selectedMergedRoom
      ? selectedMergedRoom.sourceRoomIds
      : selectedRoom 
        ? [selectedRoom]
        : null,
    [isMergedRoom, selectedMergedRoom, selectedRoom]
  );

  // Filter devices by room(s)
  const allFilteredLights = useMemo(() => {
    if (!targetRoomIds) return lights;
    return lights.filter(l => l.roomId && targetRoomIds.includes(l.roomId));
  }, [lights, targetRoomIds]);
  
  // Separate actual lights from equipment controls (Fan, Fountain, Heater, etc.)
  const { actualLights: filteredLights, equipment: filteredEquipment } = useMemo(
    () => separateLightsAndEquipment(allFilteredLights),
    [allFilteredLights]
  );
  
  const filteredShades = targetRoomIds
    ? shades.filter(s => s.roomId && targetRoomIds.includes(s.roomId))
    : shades;
  
  // Get display name for selected room
  const selectedRoomName = isMergedRoom && selectedMergedRoom
    ? selectedMergedRoom.name
    : rooms.find(r => r.id === selectedRoom)?.name;

  // Create room ID to name lookup for merged room views
  const roomNameMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => map.set(room.id, room.name));
    return map;
  }, [rooms]);

  // Helper to get room name by ID
  const getRoomName = (roomId: string | undefined) => roomId ? roomNameMap.get(roomId) : undefined;

  // Group shades by room for merged view
  const shadesByRoom = useMemo(() => {
    if (!isMergedRoom || !selectedMergedRoom) return null;
    
    const grouped = new Map<string, typeof filteredShades>();
    filteredShades.forEach(shade => {
      if (shade.roomId) {
        const existing = grouped.get(shade.roomId) || [];
        existing.push(shade);
        grouped.set(shade.roomId, existing);
      }
    });
    
    // Convert to array sorted by room name
    return Array.from(grouped.entries())
      .map(([roomId, shades]) => ({
        roomId,
        roomName: roomNameMap.get(roomId) || roomId,
        shades,
      }))
      .sort((a, b) => a.roomName.localeCompare(b.roomName));
  }, [isMergedRoom, selectedMergedRoom, filteredShades, roomNameMap]);

  // Determine if we should show equipment grouped by room
  const shouldGroupEquipment = selectedRoom === null || isMergedRoom;

  // Group equipment by room for merged view or "All Rooms" view
  const equipmentByRoom = useMemo(() => {
    // Only group when viewing All Rooms or a merged room
    if (!shouldGroupEquipment) return null;
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
  }, [shouldGroupEquipment, filteredEquipment, roomNameMap]);

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
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Rooms
                </h2>
                <Link
                  href="/rooms/merge"
                  className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  <Layers className="w-4 h-4" />
                  Manage Merged Rooms
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
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* Room Filter */}
        {rooms.length > 0 && (
          <div className="mb-6">
            <RoomTabs
              rooms={rooms}
              mergedRooms={mergedRooms}
              areas={areas}
              activeRoom={selectedRoom}
              onRoomChange={setSelectedRoom}
              onManageMergedRooms={() => setIsMergeModalOpen(true)}
              onMoveRoomToArea={moveRoomToArea}
              onCreateArea={createArea}
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scenes & Climate */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
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

            {/* Climate */}
            {thermostats.length > 0 && (
              <motion.section variants={itemVariants}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Climate
                  </h2>
                  <Link
                    href="/climate"
                    className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <ThermostatCard thermostat={thermostats[0]} compact />
              </motion.section>
            )}

            {/* Sensors Summary */}
            {sensors.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Sensors
                </h2>
                <SensorSummary sensors={sensors} />
              </motion.section>
            )}
          </motion.div>

          {/* Center Column - Lights */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="lg:col-span-2 space-y-6"
          >
            {/* Lights */}
            {filteredLights.length > 0 && (
              <motion.section variants={itemVariants} initial="show" animate="show">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Lights
                  </h2>
                </div>
                {/* Show grouped by room when "All Rooms" is selected */}
                {selectedRoom === null ? (
                  <LightsByRoom 
                    lights={lights} 
                    rooms={rooms}
                    maxLightsPerRoom={4}
                    showUnassigned
                  />
                ) : isMergedRoom && selectedMergedRoom ? (
                  /* Show devices grouped by source room for merged rooms */
                  <LightsByRoom 
                    lights={filteredLights} 
                    rooms={rooms.filter(r => selectedMergedRoom.sourceRoomIds.includes(r.id))}
                    maxLightsPerRoom={6}
                    showUnassigned={false}
                  />
                ) : (
                  /* Show flat list when a specific room is selected */
                  <div className="space-y-3">
                    <LightGroupControl 
                      lights={filteredLights} 
                      roomName={selectedRoomName}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredLights.map((light) => (
                        <motion.div key={light.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 1, y: 0 }}>
                          <LightCard light={light} compact />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Equipment (Fan, Fountain, Heater, etc.) */}
            {filteredEquipment.length > 0 && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Power className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Equipment ({filteredEquipment.length})
                  </h2>
                </div>
                {shouldGroupEquipment && equipmentByRoom && equipmentByRoom.length > 0 ? (
                  <div className="space-y-4">
                    {equipmentByRoom.map(({ roomId, roomName, equipment }) => (
                      <div key={roomId} className="space-y-2">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">{roomName}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                          {equipment.map((equip) => (
                            <EquipmentCard key={equip.id} equipment={equip} compact roomName={roomName} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredEquipment.map((equip) => (
                      <EquipmentCard key={equip.id} equipment={equip} compact />
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {/* Shades */}
            {filteredShades.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Shades
                </h2>
                {isMergedRoom && shadesByRoom ? (
                  /* Show shades grouped by room for merged views */
                  <div className="space-y-4">
                    {shadesByRoom.map(({ roomId, roomName, shades }) => (
                      <div key={roomId} className="space-y-2">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">{roomName}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                          {shades.map((shade) => (
                            <motion.div key={shade.id} variants={itemVariants}>
                              <ShadeCard shade={shade} compact />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredShades.slice(0, 4).map((shade) => (
                      <motion.div key={shade.id} variants={itemVariants}>
                        <ShadeCard shade={shade} compact roomName={selectedRoom ? undefined : getRoomName(shade.roomId)} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Security Quick Action */}
            {doorLocks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Security
                  </h2>
                  <Link
                    href="/security"
                    className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <Card padding="md" className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      unlockedDoors > 0 ? "bg-[var(--danger)]/20" : "bg-[var(--success)]/20"
                    }`}>
                      <Shield className={`w-5 h-5 ${
                        unlockedDoors > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{doorLocks.length} Door Locks</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {unlockedDoors > 0 
                          ? `${unlockedDoors} unlocked` 
                          : "All locked"}
                      </p>
                    </div>
                  </div>
                  <LockAllButton locks={doorLocks} />
                </Card>
              </section>
            )}
          </motion.div>
        </div>

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
      
      {/* Merge Rooms Modal */}
      <MergeRoomsModal
        open={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
        rooms={rooms}
        mergedRooms={mergedRooms}
      />
    </div>
  );
}
