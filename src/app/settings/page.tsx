"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
  Info,
  ChevronRight,
  RefreshCw,
  Trash2,
  LogOut,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData } from "@/stores/deviceStore";
import { useThemeStore, applyTheme } from "@/stores/themeStore";
import { usePollingStore, formatDuration, DEFAULT_POLLING_INTERVALS, DEFAULT_IDLE_THRESHOLDS } from "@/stores/pollingStore";

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

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
  const router = useRouter();
  const { isConnected, processorIp, disconnect } = useAuthStore();
  const { lights, rooms, scenes, thermostats, doorLocks, shades, sensors, mediaRooms } = useDeviceStore();
  const { theme, setTheme } = useThemeStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Polling settings
  const {
    activeInterval,
    idle1MinInterval,
    idle5MinInterval,
    idle10MinInterval,
    idleThreshold1,
    idleThreshold2,
    idleThreshold3,
    setActiveInterval,
    setIdle1MinInterval,
    setIdle5MinInterval,
    setIdle10MinInterval,
    setIdleThreshold1,
    setIdleThreshold2,
    setIdleThreshold3,
    resetToDefaults,
  } = usePollingStore();

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  const handleClearCache = () => {
    if (confirm("Clear all cached data? You will need to reconnect to your processor.")) {
      localStorage.clear();
      window.location.href = "/login";
    }
  };

  const handleDisconnect = () => {
    disconnect();
    router.push("/login");
  };

  if (!isConnected) {
    return null;
  }

  // Device counts
  const deviceCounts = [
    { label: "Lights", count: lights.length },
    { label: "Rooms", count: rooms.length },
    { label: "Scenes", count: scenes.length },
    { label: "Thermostats", count: thermostats.length },
    { label: "Door Locks", count: doorLocks.length },
    { label: "Shades", count: shades.length },
    { label: "Sensors", count: sensors.length },
    { label: "Media Rooms", count: mediaRooms.length },
  ].filter(d => d.count > 0);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Settings
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Customize your experience
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Appearance */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Appearance
            </h2>
            <Card padding="none" className="overflow-hidden">
              <div className="p-4">
                <p className="font-medium text-[var(--text-primary)] mb-1">Theme</p>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Choose your preferred color scheme
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${theme === "light" 
                        ? "border-[var(--accent)] bg-[var(--accent)]/5" 
                        : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                      }
                    `}
                  >
                    <Sun className={`w-6 h-6 ${theme === "light" ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                    <span className={`text-sm font-medium ${theme === "light" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                      Light
                    </span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${theme === "dark" 
                        ? "border-[var(--accent)] bg-[var(--accent)]/5" 
                        : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                      }
                    `}
                  >
                    <Moon className={`w-6 h-6 ${theme === "dark" ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                      Dark
                    </span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("system")}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${theme === "system" 
                        ? "border-[var(--accent)] bg-[var(--accent)]/5" 
                        : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                      }
                    `}
                  >
                    <Monitor className={`w-6 h-6 ${theme === "system" ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                    <span className={`text-sm font-medium ${theme === "system" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                      System
                    </span>
                  </button>
                </div>
              </div>
            </Card>
          </motion.section>

          {/* Connection */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Connection
            </h2>
            <Card padding="none" className="overflow-hidden divide-y divide-[var(--border-light)]">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <Wifi className="w-5 h-5 text-[var(--success)]" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-[var(--danger)]" />
                  )}
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Processor</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {processorIp || "Not connected"}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isConnected 
                    ? "bg-[var(--success)]/10 text-[var(--success)]" 
                    : "bg-[var(--danger)]/10 text-[var(--danger)]"
                }`}>
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className={`w-5 h-5 text-[var(--text-tertiary)] ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="font-medium text-[var(--text-primary)]">Refresh Data</span>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-[var(--danger)]" />
                  <span className="font-medium text-[var(--danger)]">Disconnect</span>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </Card>
          </motion.section>

          {/* Polling Settings */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Polling Settings
            </h2>
            <Card padding="md" className="space-y-4">
              {/* Description */}
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-[var(--text-secondary)]">
                  Configure how often the app fetches data from your Crestron processor.
                </p>
              </div>

              {/* Settings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-2 font-medium text-[var(--text-secondary)]">
                        Idle Duration
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-[var(--text-secondary)]">
                        Polling Interval
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {/* Active Row */}
                    <tr className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 px-2 text-[var(--text-primary)]">
                        Active (user interacting)
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={activeInterval}
                            onChange={(e) => setActiveInterval(parseInt(e.target.value) || 3)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-secondary)]">seconds</span>
                        </div>
                      </td>
                    </tr>
                    {/* Tier 1 Row */}
                    <tr className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2 text-[var(--text-primary)]">
                          <span>After</span>
                          <input
                            type="number"
                            min="10"
                            max="300"
                            value={idleThreshold1}
                            onChange={(e) => setIdleThreshold1(parseInt(e.target.value) || 60)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-tertiary)]">sec idle</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="300"
                            value={idle1MinInterval}
                            onChange={(e) => setIdle1MinInterval(parseInt(e.target.value) || 10)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-secondary)]">seconds</span>
                        </div>
                      </td>
                    </tr>
                    {/* Tier 2 Row */}
                    <tr className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2 text-[var(--text-primary)]">
                          <span>After</span>
                          <input
                            type="number"
                            min="60"
                            max="600"
                            value={idleThreshold2}
                            onChange={(e) => setIdleThreshold2(parseInt(e.target.value) || 300)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-tertiary)]">sec idle</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="600"
                            value={idle5MinInterval}
                            onChange={(e) => setIdle5MinInterval(parseInt(e.target.value) || 60)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-secondary)]">seconds</span>
                        </div>
                      </td>
                    </tr>
                    {/* Tier 3 Row */}
                    <tr className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2 text-[var(--text-primary)]">
                          <span>After</span>
                          <input
                            type="number"
                            min="120"
                            max="1800"
                            value={idleThreshold3}
                            onChange={(e) => setIdleThreshold3(parseInt(e.target.value) || 600)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-tertiary)]">sec idle</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="60"
                            max="3600"
                            value={idle10MinInterval}
                            onChange={(e) => setIdle10MinInterval(parseInt(e.target.value) || 1800)}
                            className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          />
                          <span className="text-[var(--text-secondary)]">seconds</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Reset Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={resetToDefaults}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border-light)] transition-colors text-sm text-[var(--text-secondary)]"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </button>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Default: {DEFAULT_POLLING_INTERVALS.active}s active
                </p>
              </div>
            </Card>
          </motion.section>

          {/* Device Summary */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Devices
            </h2>
            <Card padding="md">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {deviceCounts.map(({ label, count }) => (
                  <div key={label} className="text-center">
                    <p className="text-2xl font-semibold text-[var(--text-primary)]">{count}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.section>

          {/* Data Management */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Data
            </h2>
            <Card padding="none" className="overflow-hidden">
              <button
                onClick={handleClearCache}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-[var(--danger)]" />
                  <div className="text-left">
                    <p className="font-medium text-[var(--text-primary)]">Clear Cache</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Remove all stored data and settings
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </Card>
          </motion.section>

          {/* About */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              About
            </h2>
            <Card padding="md">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center shadow-lg">
                  <Info className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] text-lg">Tutera Home</p>
                  <p className="text-sm text-[var(--text-secondary)]">Version 1.0.0</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Crestron Home Automation Control
                  </p>
                </div>
              </div>
            </Card>
          </motion.section>
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}


