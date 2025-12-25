"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield,
  RefreshCw,
  Lock,
  Activity,
  DoorClosed,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { LockCard, LockAllButton } from "@/components/devices/LockCard";
import { SensorCard } from "@/components/devices/SensorCard";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllDevices } from "@/stores/deviceStore";

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

export default function SecurityPage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  const { doorLocks, sensors, securityDevices, isLoading } = useDeviceStore();

  // Filter to security-related sensors
  const securitySensors = sensors.filter(
    s => s.subType === "motion" || s.subType === "contact"
  );

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (isConnected) {
      fetchAllDevices();
    }
  }, [isConnected]);

  if (!isConnected) return null;

  // Calculate stats
  const unlockedCount = doorLocks.filter(l => !l.isLocked).length;
  const motionActive = sensors.filter(s => s.subType === "motion" && Boolean(s.value)).length;
  const openDoors = sensors.filter(s => s.subType === "contact" && !Boolean(s.value)).length;
  const allSecure = unlockedCount === 0 && openDoors === 0;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              allSecure 
                ? "bg-gradient-to-br from-green-500 to-emerald-600" 
                : "bg-gradient-to-br from-orange-500 to-red-600"
            }`}>
              {allSecure ? (
                <ShieldCheck className="w-6 h-6 text-white" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Security
              </h1>
              <p className={`text-sm font-medium ${
                allSecure ? "text-[var(--success)]" : "text-[var(--warning)]"
              }`}>
                {allSecure ? "All secure" : "Attention needed"}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchAllDevices()}
            disabled={isLoading}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Security Status Banner */}
        <Card 
          padding="lg" 
          className={`mb-6 ${
            allSecure 
              ? "bg-[var(--success)]/10 border-[var(--success)]/30" 
              : "bg-[var(--warning)]/10 border-[var(--warning)]/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                allSecure ? "bg-[var(--success)]" : "bg-[var(--warning)]"
              }`}>
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {allSecure ? "Home Secured" : "Security Alert"}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm text-[var(--text-secondary)]">
                    <Lock className="w-4 h-4 inline mr-1" />
                    {unlockedCount === 0 ? "All locked" : `${unlockedCount} unlocked`}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    <DoorClosed className="w-4 h-4 inline mr-1" />
                    {openDoors === 0 ? "All closed" : `${openDoors} open`}
                  </span>
                </div>
              </div>
            </div>
            {doorLocks.length > 0 && <LockAllButton locks={doorLocks} />}
          </div>
        </Card>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Door Locks */}
          {doorLocks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Door Locks
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {doorLocks.map((lock) => (
                  <motion.div key={lock.id} variants={itemVariants}>
                    <LockCard lock={lock} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Motion Sensors */}
          {securitySensors.filter(s => s.subType === "motion").length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Motion Sensors
                </h2>
                {motionActive > 0 && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-600 text-xs font-medium rounded-full">
                    {motionActive} active
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {securitySensors
                  .filter(s => s.subType === "motion")
                  .map((sensor) => (
                    <motion.div key={sensor.id} variants={itemVariants}>
                      <SensorCard sensor={sensor} compact />
                    </motion.div>
                  ))}
              </div>
            </section>
          )}

          {/* Contact Sensors (Doors/Windows) */}
          {securitySensors.filter(s => s.subType === "contact").length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <DoorClosed className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Doors & Windows
                </h2>
                {openDoors > 0 && (
                  <span className="px-2 py-0.5 bg-[var(--warning)]/20 text-[var(--warning)] text-xs font-medium rounded-full">
                    {openDoors} open
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {securitySensors
                  .filter(s => s.subType === "contact")
                  .map((sensor) => (
                    <motion.div key={sensor.id} variants={itemVariants}>
                      <SensorCard sensor={sensor} compact />
                    </motion.div>
                  ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {doorLocks.length === 0 && securitySensors.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                No Security Devices Found
              </h3>
              <p className="text-[var(--text-secondary)]">
                Security devices connected to your Crestron system will appear here.
              </p>
            </div>
          )}
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}

