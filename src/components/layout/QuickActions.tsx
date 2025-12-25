"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  X,
  Moon,
  Sun,
  Lock,
  Lightbulb,
  Home,
  Palette,
} from "lucide-react";
import { useDeviceStore, setLightState, recallScene, setDoorLockState } from "@/stores/deviceStore";

interface QuickActionItem {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  action: () => Promise<void>;
}

export function QuickActionsBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);
  
  const { lights, doorLocks, scenes } = useDeviceStore();

  // Define quick actions based on available devices
  const quickActions: QuickActionItem[] = [
    // All Lights Off
    {
      id: "lights-off",
      icon: Moon,
      label: "All Off",
      color: "#6366F1",
      action: async () => {
        for (const light of lights) {
          if (light.isOn || light.level > 0) {
            await setLightState(light.id, 0, false);
          }
        }
      },
    },
    // All Lights On
    {
      id: "lights-on",
      icon: Sun,
      label: "All On",
      color: "#F59E0B",
      action: async () => {
        for (const light of lights) {
          if (!light.isOn && light.level === 0) {
            await setLightState(light.id, 65535, true);
          }
        }
      },
    },
    // Lock All
    {
      id: "lock-all",
      icon: Lock,
      label: "Lock All",
      color: "#22C55E",
      action: async () => {
        for (const lock of doorLocks) {
          if (!lock.isLocked) {
            await setDoorLockState(lock.id, true);
          }
        }
      },
    },
  ];

  // Add first 2 scenes as quick actions
  scenes.slice(0, 2).forEach((scene) => {
    quickActions.push({
      id: `scene-${scene.id}`,
      icon: Palette,
      label: scene.name.length > 10 ? scene.name.substring(0, 10) + "…" : scene.name,
      color: "#EC4899",
      action: async () => {
        await recallScene(scene.id);
      },
    });
  });

  const handleAction = async (action: QuickActionItem) => {
    setIsExecuting(action.id);
    await action.action();
    setIsExecuting(null);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-colors duration-300
          ${isOpen ? "bg-[var(--text-primary)]" : "bg-[var(--accent)]"}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Zap className="w-6 h-6 text-white" />
          )}
        </motion.div>
      </motion.button>

      {/* Quick Actions Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            
            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-40 right-4 md:bottom-24 md:right-6 z-50 flex flex-col items-end gap-3"
            >
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleAction(action)}
                  disabled={isExecuting !== null}
                  className="flex items-center gap-3 group"
                >
                  <span className="px-3 py-1.5 bg-[var(--surface)] rounded-lg shadow-md text-sm font-medium text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.label}
                  </span>
                  <div
                    className={`
                      w-12 h-12 rounded-full shadow-lg flex items-center justify-center
                      transition-all duration-200
                      ${isExecuting === action.id ? "animate-pulse" : ""}
                    `}
                    style={{ backgroundColor: action.color }}
                  >
                    {isExecuting === action.id ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <action.icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default QuickActionsBar;

