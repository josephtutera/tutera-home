"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Thermometer, RefreshCw, Droplets, CloudSun, Home, Building2, Layers } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { ThermostatRoomGroup } from "@/components/devices/ThermostatRoomGroup";
import { ThermostatZoneControl } from "@/components/devices/ThermostatZoneControl";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import { SensorCard } from "@/components/devices/SensorCard";
import { Card } from "@/components/ui/Card";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData, getThermostatPairs, getThermostatZonesWithData } from "@/stores/deviceStore";
import { useWeatherStore, fetchWeather } from "@/stores/weatherStore";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type ViewMode = "zones" | "rooms";

export default function ClimatePage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  const { thermostats, sensors, isLoading } = useDeviceStore();
  const { outsideTemp } = useWeatherStore();
  
  // View mode: zones (grouped by floor) or rooms (individual)
  const [viewMode, setViewMode] = useState<ViewMode>("zones");
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>("whole-house");

  // Get thermostat pairs grouped by room
  const thermostatPairs = useMemo(() => getThermostatPairs(), [thermostats]);
  
  // Get thermostat zones with computed data
  const thermostatZones = useMemo(() => getThermostatZonesWithData(), [thermostats]);

  // Filter to climate-related sensors
  const climateSensors = sensors.filter(
    s => s.subType === "temperature" || s.subType === "humidity"
  );

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather();
  }, []);

  if (!isConnected) return null;

  // Calculate averages from sensors
  const tempSensors = sensors.filter(s => s.subType === "temperature");
  const humiditySensors = sensors.filter(s => s.subType === "humidity");
  const avgHumidity = humiditySensors.length > 0
    ? Math.round(humiditySensors.reduce((sum, s) => sum + Number(s.value), 0) / humiditySensors.length)
    : null;
    
  const handleZoneToggle = (zoneId: string) => {
    setExpandedZoneId(prev => prev === zoneId ? null : zoneId);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Climate
              </h1>
              <RefreshedAt />
            </div>
          </div>
          <button
            onClick={() => fetchAllData()}
            disabled={isLoading}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Outside Temperature & Humidity Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Outside Temperature */}
            <Card padding="md" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center">
                <CloudSun className="w-6 h-6 text-sky-500" />
              </div>
              <div>
                <p className="text-3xl font-semibold">
                  {outsideTemp !== null ? `${outsideTemp}°` : "--°"}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">Outside Temperature</p>
              </div>
            </Card>

            {/* Humidity Stats (if available) */}
            {avgHumidity !== null && (
              <Card padding="md" className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Droplets className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <p className="text-3xl font-semibold">{avgHumidity}%</p>
                  <p className="text-sm text-[var(--text-secondary)]">Average Humidity</p>
                </div>
              </Card>
            )}
          </motion.div>

          {/* View Mode Toggle */}
          {thermostats.length > 0 && (
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Temperature Control
                </h2>
                <div className="flex items-center gap-1 p-1 bg-[var(--surface)] rounded-xl">
                  <button
                    onClick={() => setViewMode("zones")}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${viewMode === "zones"
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }
                    `}
                  >
                    <Layers className="w-4 h-4" />
                    By Zone
                  </button>
                  <button
                    onClick={() => setViewMode("rooms")}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${viewMode === "rooms"
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
            </motion.div>
          )}

          {/* Zone Controls */}
          {viewMode === "zones" && thermostatZones.length > 0 && (
            <section>
              <div className="space-y-4">
                {thermostatZones.map((zoneData, index) => (
                  <motion.div 
                    key={zoneData.zone.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    layout
                  >
                    <ThermostatZoneControl
                      zoneData={zoneData}
                      expanded={expandedZoneId === zoneData.zone.id}
                      onToggleExpand={() => handleZoneToggle(zoneData.zone.id)}
                    />
                  </motion.div>
                ))}
              </div>
              
              {/* Zone Legend */}
              <div className="mt-6 p-4 bg-[var(--surface)] rounded-xl">
                <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">
                  About Zones
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Zones group thermostats by floor or area. Changing settings on a zone applies to all thermostats within it. 
                  <strong className="text-[var(--text-primary)]"> Whole House</strong> controls all {thermostats.filter(t => !t.name.toLowerCase().includes('floor heat')).length} thermostats at once.
                </p>
              </div>
            </section>
          )}

          {/* Room-by-Room Controls */}
          {viewMode === "rooms" && (
            <section>
              {thermostatPairs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {thermostatPairs.map((pair, index) => (
                    <motion.div 
                      key={pair.roomId} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ThermostatRoomGroup pair={pair} />
                    </motion.div>
                  ))}
                </div>
              ) : thermostats.length > 0 ? (
                // Fallback: show individual thermostats when pairs aren't available
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {thermostats.map((thermostat, index) => (
                    <motion.div 
                      key={thermostat.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ThermostatCard thermostat={thermostat} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Thermometer className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                    No Thermostats Found
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    Thermostats connected to your Crestron system will appear here.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Climate Sensors */}
          {climateSensors.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Climate Sensors
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {climateSensors.map((sensor) => (
                  <motion.div key={sensor.id} variants={itemVariants}>
                    <SensorCard sensor={sensor} compact />
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}
