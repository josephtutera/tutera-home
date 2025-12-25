"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lightbulb,
  Thermometer,
  Shield,
  Palette,
  Blinds,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNavigation, RoomTabs } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { LightCard, LightGroupControl } from "@/components/devices/LightCard";
import { ShadeCard } from "@/components/devices/ShadeCard";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import { SceneGrid } from "@/components/devices/SceneCard";
import { LockAllButton } from "@/components/devices/LockCard";
import { SensorSummary } from "@/components/devices/SensorCard";
import { QuickActionsBar } from "@/components/layout/QuickActions";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchRooms, fetchAllDevices, fetchScenes } from "@/stores/deviceStore";

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
    rooms, 
    lights, 
    shades, 
    scenes, 
    thermostats, 
    doorLocks,
    sensors,
    isLoading,
    lastUpdated,
  } = useDeviceStore();
  
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  // Fetch data on mount
  useEffect(() => {
    if (isConnected) {
      fetchRooms();
      fetchAllDevices();
      fetchScenes();
    }
  }, [isConnected]);

  // Filter devices by room
  const filteredLights = selectedRoom 
    ? lights.filter(l => l.roomId === selectedRoom)
    : lights;
  
  const filteredShades = selectedRoom
    ? shades.filter(s => s.roomId === selectedRoom)
    : shades;

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRooms(), fetchAllDevices(), fetchScenes()]);
    setIsRefreshing(false);
  };

  // Stats
  const lightsOn = lights.filter(l => l.isOn || l.level > 0).length;
  const unlockedDoors = doorLocks.filter(l => !l.isLocked).length;

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
            {lastUpdated && (
              <p className="text-sm text-[var(--text-secondary)]">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isRefreshing ? "animate-spin" : ""}`} />
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
              <div className="w-10 h-10 rounded-xl bg-[var(--shade-color)]/20 flex items-center justify-center">
                <Blinds className="w-5 h-5 text-[var(--shade-color)]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{shades.length}</p>
                <p className="text-xs text-[var(--text-secondary)]">Shades</p>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Room Filter */}
        {rooms.length > 0 && (
          <div className="mb-6">
            <RoomTabs
              rooms={rooms}
              activeRoom={selectedRoom}
              onRoomChange={setSelectedRoom}
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
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Lights
                  </h2>
                </div>
                <div className="space-y-3">
                  <LightGroupControl lights={filteredLights} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredLights.slice(0, 6).map((light, index) => (
                      <motion.div key={light.id} variants={itemVariants}>
                        <LightCard light={light} compact />
                      </motion.div>
                    ))}
                  </div>
                  {filteredLights.length > 6 && (
                    <p className="text-center text-sm text-[var(--text-secondary)]">
                      +{filteredLights.length - 6} more lights
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Shades */}
            {filteredShades.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Shades
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredShades.slice(0, 4).map((shade) => (
                    <motion.div key={shade.id} variants={itemVariants}>
                      <ShadeCard shade={shade} compact />
                    </motion.div>
                  ))}
                </div>
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
    </div>
  );
}
