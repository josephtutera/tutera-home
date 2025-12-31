"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Settings, Sliders, Grid3X3, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore, type ZoneControlStyle } from "@/stores/settingsStore";

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
  const { isConnected } = useAuthStore();
  const { 
    zoneControlStyle, 
    setZoneControlStyle,
    sliderActivationDelay,
    setSliderActivationDelay,
  } = useSettingsStore();

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

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
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}
