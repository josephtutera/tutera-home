"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Settings, Sliders, Grid3X3, RotateCcw, Zap, Move, Home, ChevronRight, Tv } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePollingStore, formatDuration } from "@/stores/pollingStore";

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

export default function SettingsPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const { isConnected } = useAuthStore();
  const { 
    zoneControlStyle, 
    setZoneControlStyle,
    sliderActivationDelay,
    setSliderActivationDelay,
    quickActionsEnabled,
    setQuickActionsEnabled,
    quickActionsPosition,
    resetQuickActionsPosition,
  } = useSettingsStore();

  const {
    activeInterval,
    idle1MinInterval,
    idle5MinInterval,
    idle10MinInterval,
    setActiveInterval,
    setIdle1MinInterval,
    setIdle5MinInterval,
    setIdle10MinInterval,
    resetToDefaults,
  } = usePollingStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isConnected) {
      router.push("/login");
    }
  }, [isConnected, router, isMounted]);

  // Wait for hydration to complete
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Settings
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Customize your experience
            </p>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Lighting Settings */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Lighting Controls
            </h2>
            
            <Card padding="none" className="divide-y divide-[var(--border)]">
              {/* Zone Control Style */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-[var(--text-primary)]">
                      Zone Control Style
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Choose how to adjust brightness for lighting zones
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setZoneControlStyle("buttons")}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${zoneControlStyle === "buttons"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] hover:border-[var(--border-hover)]"
                      }
                    `}
                  >
                    <Grid3X3 className={`w-8 h-8 ${zoneControlStyle === "buttons" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                    <div className="text-center">
                      <p className={`font-medium ${zoneControlStyle === "buttons" ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                        Buttons
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        Preset levels (safer)
                      </p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setZoneControlStyle("slider")}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${zoneControlStyle === "slider"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] hover:border-[var(--border-hover)]"
                      }
                    `}
                  >
                    <Sliders className={`w-8 h-8 ${zoneControlStyle === "slider" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                    <div className="text-center">
                      <p className={`font-medium ${zoneControlStyle === "slider" ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                        Slider
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        Fine control
                      </p>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Slider Activation Delay (only show when slider mode is selected) */}
              {zoneControlStyle === "slider" && (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-[var(--text-primary)]">
                        Slider Activation Delay
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Hold time required before slider responds (prevents accidental changes)
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="100"
                        max="800"
                        step="50"
                        value={sliderActivationDelay}
                        onChange={(e) => setSliderActivationDelay(parseInt(e.target.value, 10))}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer
                          bg-[var(--border)]
                          [&::-webkit-slider-thumb]:appearance-none
                          [&::-webkit-slider-thumb]:w-5
                          [&::-webkit-slider-thumb]:h-5
                          [&::-webkit-slider-thumb]:rounded-full
                          [&::-webkit-slider-thumb]:bg-[var(--accent)]
                          [&::-webkit-slider-thumb]:shadow-md
                          [&::-webkit-slider-thumb]:cursor-pointer
                          [&::-moz-range-thumb]:w-5
                          [&::-moz-range-thumb]:h-5
                          [&::-moz-range-thumb]:rounded-full
                          [&::-moz-range-thumb]:bg-[var(--accent)]
                          [&::-moz-range-thumb]:shadow-md
                          [&::-moz-range-thumb]:cursor-pointer
                          [&::-moz-range-thumb]:border-0"
                      />
                      <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums w-16 text-right">
                        {sliderActivationDelay}ms
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-2">
                      <span>Quick (100ms)</span>
                      <span>Safe (800ms)</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
            
            {/* Explanation */}
            <div className="mt-3 p-3 bg-[var(--surface)] rounded-xl">
              <p className="text-xs text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Tip:</strong> On touch devices, 
                the slider mode requires you to hold for {sliderActivationDelay}ms before it activates. 
                This prevents accidental brightness changes while scrolling. 
                Buttons mode is safer as it requires a deliberate tap.
              </p>
            </div>
          </motion.section>

          {/* Quick Actions Button Settings */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Quick Actions Button
            </h2>
            
            <Card padding="none" className="divide-y divide-[var(--border)]">
              {/* Enable/Disable Toggle */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)]">
                        Show Quick Actions
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Floating button for fast access to common actions
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setQuickActionsEnabled(!quickActionsEnabled)}
                    className={`
                      relative w-12 h-7 rounded-full transition-colors duration-200
                      ${quickActionsEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"}
                    `}
                  >
                    <div
                      className={`
                        absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                        ${quickActionsEnabled ? "translate-x-6" : "translate-x-1"}
                      `}
                    />
                  </button>
                </div>
              </div>

              {/* Reset Position (only show when enabled and has custom position) */}
              {quickActionsEnabled && quickActionsPosition && (
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Move className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-[var(--text-primary)]">
                          Button Position
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Currently at custom position
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetQuickActionsPosition}
                      className="px-3 py-1.5 text-sm font-medium text-[var(--accent)] bg-[var(--accent)]/10 rounded-lg hover:bg-[var(--accent)]/20 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Explanation */}
            <div className="mt-3 p-3 bg-[var(--surface)] rounded-xl">
              <p className="text-xs text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Tip:</strong> The Quick Actions button 
                can be dragged anywhere on the screen. Drag it to a position that doesn&apos;t get in your way. 
                Use the Reset button above to return it to the default position.
              </p>
            </div>
          </motion.section>

          {/* Room Management */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Room Management
            </h2>
            
            <Card padding="none">
              <Link href="/rooms/virtual" className="flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                    <Home className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">
                      Manage Virtual Rooms
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Group rooms together for easier control
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
              </Link>
            </Card>
          </motion.section>

          {/* Device Setup */}
          <motion.section variants={itemVariants}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Device Setup
            </h2>
            
            <Card padding="none">
              <Link href="/settings/appletv" className="flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <Tv className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">
                      Apple TV Pairing
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Connect Apple TVs for remote control
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
              </Link>
            </Card>
          </motion.section>

          {/* API Refresh Settings */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                API Refresh Rate
              </h2>
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to defaults
              </button>
            </div>
            
            <Card padding="none" className="divide-y divide-[var(--border)]">
              {/* Active Interval */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">
                      Active Use
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      When you&apos;re actively using the app
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--accent)] tabular-nums">
                    {formatDuration(activeInterval)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={activeInterval}
                  onChange={(e) => setActiveInterval(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                    bg-[var(--border)]
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[var(--accent)]
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-[var(--accent)]
                    [&::-moz-range-thumb]:border-0"
                />
              </div>

              {/* Idle 1 Min Interval */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">
                      After 1 Minute Idle
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Slower refresh when idle briefly
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--accent)] tabular-nums">
                    {formatDuration(idle1MinInterval)}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={idle1MinInterval}
                  onChange={(e) => setIdle1MinInterval(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                    bg-[var(--border)]
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[var(--accent)]
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-[var(--accent)]
                    [&::-moz-range-thumb]:border-0"
                />
              </div>

              {/* Idle 5 Min Interval */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">
                      After 5 Minutes Idle
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Reduced polling for battery savings
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--accent)] tabular-nums">
                    {formatDuration(idle5MinInterval)}
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="300"
                  step="30"
                  value={idle5MinInterval}
                  onChange={(e) => setIdle5MinInterval(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                    bg-[var(--border)]
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[var(--accent)]
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-[var(--accent)]
                    [&::-moz-range-thumb]:border-0"
                />
              </div>

              {/* Idle 10 Min Interval */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">
                      After 10 Minutes Idle
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Minimal polling when inactive
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--accent)] tabular-nums">
                    {formatDuration(idle10MinInterval)}
                  </span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="3600"
                  step="300"
                  value={idle10MinInterval}
                  onChange={(e) => setIdle10MinInterval(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                    bg-[var(--border)]
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[var(--accent)]
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-[var(--accent)]
                    [&::-moz-range-thumb]:border-0"
                />
              </div>
            </Card>

            {/* Explanation */}
            <div className="mt-3 p-3 bg-[var(--surface)] rounded-xl">
              <p className="text-xs text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">How it works:</strong> The app 
                automatically adjusts how often it fetches data based on your activity. 
                When you&apos;re actively interacting, it refreshes every {formatDuration(activeInterval)}. 
                After periods of inactivity, it slows down to save battery and reduce server load.
                Pull down on any page to manually refresh.
              </p>
            </div>
          </motion.section>
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}
