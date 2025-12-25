"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Lightbulb, Blinds } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { LightCard, LightGroupControl } from "@/components/devices/LightCard";
import { ShadeCard } from "@/components/devices/ShadeCard";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import { SensorCard } from "@/components/devices/SensorCard";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchRooms, fetchAllDevices } from "@/stores/deviceStore";

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
  const { rooms, lights, shades, thermostats, sensors, isLoading } = useDeviceStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Find current room
  const room = rooms.find(r => r.id === roomId);
  
  // Filter devices by room
  const roomLights = lights.filter(l => l.roomId === roomId);
  const roomShades = shades.filter(s => s.roomId === roomId);
  const roomThermostats = thermostats.filter(t => t.roomId === roomId);
  const roomSensors = sensors.filter(s => s.roomId === roomId);

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (isConnected) {
      fetchRooms();
      fetchAllDevices();
    }
  }, [isConnected]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRooms(), fetchAllDevices()]);
    setIsRefreshing(false);
  };

  if (!isConnected) return null;

  const totalDevices = roomLights.length + roomShades.length + roomThermostats.length + roomSensors.length;

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
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                {room?.name || "Room"}
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {totalDevices} device{totalDevices !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Lights */}
          {roomLights.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-[var(--light-color)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Lights
                </h2>
              </div>
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

