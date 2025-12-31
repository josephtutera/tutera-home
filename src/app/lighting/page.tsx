"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lightbulb, RefreshCw, Layers, Building2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { LightingZoneControl } from "@/components/devices/LightingZoneControl";
import { LightingRoomGroup } from "@/components/devices/LightingRoomGroup";
import { Card } from "@/components/ui/Card";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData, getLightingZonesWithData, getLightingRoomGroups } from "@/stores/deviceStore";
import { separateLightsAndEquipment } from "@/lib/crestron/types";

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

export default function LightingPage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  // Use useShallow to prevent re-renders when object references change but values are the same
  const { lights, isLoading } = useDeviceStore(useShallow((state) => ({
    lights: state.lights,
    isLoading: state.isLoading,
  })));
  
  // View mode: zones (grouped by area) or rooms (individual)
  const [viewMode, setViewMode] = useState<ViewMode>("zones");
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [expandedRoomIds, setExpandedRoomIds] = useState<Set<string>>(new Set());
  
  // Get lighting zones with computed data
  const lightingZones = useMemo(() => getLightingZonesWithData(), [lights]);
  
  // Get lighting room groups
  const lightingRoomGroups = useMemo(() => getLightingRoomGroups(), [lights]);
  
  // Filter to actual lights (excluding equipment)
  const { actualLights } = useMemo(() => separateLightsAndEquipment(lights), [lights]);

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  if (!isConnected) return null;

  // Calculate statistics
  const totalLights = actualLights.length;
  const lightsOn = actualLights.filter(l => l.isOn || l.level > 0).length;
  const avgBrightness = totalLights > 0
    ? Math.round((actualLights.reduce((sum, l) => sum + Math.round((l.level / 65535) * 100), 0) / totalLights))
    : 0;
    
  const handleZoneToggle = (zoneId: string) => {
    setExpandedZoneId(prev => prev === zoneId ? null : zoneId);
  };

  const handleRoomToggle = (roomId: string) => {
    const newExpanded = new Set(expandedRoomIds);
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId);
    } else {
      newExpanded.add(roomId);
    }
    setExpandedRoomIds(newExpanded);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Lighting
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
          {/* Lighting Stats - Compact for mobile */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Total Lights */}
            <Card padding="sm" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-semibold">{totalLights}</p>
                <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Total</p>
              </div>
            </Card>

            {/* Lights On */}
            <Card padding="sm" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-semibold">{lightsOn}</p>
                <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">On</p>
              </div>
            </Card>

            {/* Average Brightness */}
            <Card padding="sm" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-semibold">{avgBrightness}%</p>
                <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Brightness</p>
              </div>
            </Card>
          </motion.div>

          {/* View Mode Toggle */}
          {actualLights.length > 0 && (
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Light Control
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
          {viewMode === "zones" && lightingZones.length > 0 && (
            <section>
              <div className="space-y-4">
                {lightingZones.map((zoneData, index) => (
                  <motion.div 
                    key={zoneData.zone.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    layout
                  >
                    <LightingZoneControl
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
                  Zones group lights by area or floor. Changing settings on a zone applies to all lights within it. 
                  <strong className="text-[var(--text-primary)]"> Whole House</strong> controls all {totalLights} lights at once.
                </p>
              </div>
            </section>
          )}

          {/* Room-by-Room Controls */}
          {viewMode === "rooms" && (
            <section>
              {lightingRoomGroups.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {lightingRoomGroups.map((group, index) => (
                    <motion.div 
                      key={group.roomId} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <LightingRoomGroup 
                        group={group}
                        expanded={expandedRoomIds.has(group.roomId || '')}
                        onToggleExpand={() => handleRoomToggle(group.roomId || '')}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                    No Lights Found
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    Lights connected to your Crestron system will appear here.
                  </p>
                </div>
              )}
            </section>
          )}
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}

