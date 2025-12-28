"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Fan, Flame, Waves, Droplets, Power } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Light } from "@/lib/crestron/types";
import { setLightState } from "@/stores/deviceStore";

interface EquipmentCardProps {
  equipment: Light;
  compact?: boolean;
  roomName?: string;
}

// Get appropriate icon based on equipment name
function getEquipmentIcon(name: string) {
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes("fan")) return Fan;
  if (lowercaseName.includes("fountain") || lowercaseName.includes("pool") || lowercaseName.includes("spa")) return Waves;
  if (lowercaseName.includes("heater") || lowercaseName.includes("fireplace") || lowercaseName.includes("fire")) return Flame;
  if (lowercaseName.includes("pump")) return Droplets;
  return Power;
}

// Get accent color based on equipment type
function getEquipmentColor(name: string): string {
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes("fan")) return "var(--accent)";
  if (lowercaseName.includes("fountain") || lowercaseName.includes("pool") || lowercaseName.includes("spa")) return "#3b82f6"; // blue
  if (lowercaseName.includes("heater") || lowercaseName.includes("fireplace") || lowercaseName.includes("fire")) return "#f97316"; // orange
  if (lowercaseName.includes("pump")) return "#06b6d4"; // cyan
  return "var(--accent)";
}

export function EquipmentCard({ equipment, compact = false, roomName }: EquipmentCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const isOn = equipment.isOn || equipment.level > 0;
  const Icon = getEquipmentIcon(equipment.name);
  const accentColor = getEquipmentColor(equipment.name);

  const handleToggle = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    if (isOn) {
      await setLightState(equipment.id, 0, false);
    } else {
      await setLightState(equipment.id, 65535, true);
    }
    setIsUpdating(false);
  }, [equipment.id, isUpdating, isOn]);

  if (compact) {
    return (
      <Card
        hoverable
        padding="sm"
        onClick={handleToggle}
        className={`
          cursor-pointer transition-all duration-300
          ${isUpdating ? "opacity-70 pointer-events-none" : ""}
          ${isOn ? "border-2" : ""}
        `}
        style={isOn ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              animate={{
                backgroundColor: isOn ? accentColor : "var(--surface-hover)",
                scale: isOn ? 1 : 0.95,
              }}
              transition={{ duration: 0.2 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              <Icon className={`w-5 h-5 transition-colors duration-200 ${isOn ? "text-white" : "text-[var(--text-tertiary)]"}`} />
            </motion.div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {equipment.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {roomName && <span className="text-[var(--text-tertiary)]">{roomName} · </span>}
                <span className={isOn ? "text-[var(--success)]" : ""}>
                  {isOn ? "On" : "Off"}
                </span>
              </p>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              animate={{
                backgroundColor: isOn ? accentColor : "var(--surface-hover)",
              }}
              className="w-3 h-3 rounded-full"
            />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      hoverable
      padding="md"
      onClick={handleToggle}
      className={`
        cursor-pointer transition-all duration-300
        ${isUpdating ? "opacity-70 pointer-events-none" : ""}
        ${isOn ? "border-2" : ""}
      `}
      style={isOn ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{
              backgroundColor: isOn ? accentColor : "var(--surface-hover)",
              scale: isOn ? 1 : 0.95,
            }}
            transition={{ duration: 0.2 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
          >
            <Icon className={`w-7 h-7 transition-colors duration-200 ${isOn ? "text-white" : "text-[var(--text-tertiary)]"}`} />
          </motion.div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              {equipment.name}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {roomName && <span>{roomName} · </span>}
              <span className={isOn ? "text-[var(--success)] font-medium" : ""}>
                {isOn ? "Running" : "Off"}
              </span>
            </p>
          </div>
        </div>
        
        {/* Toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          disabled={isUpdating}
          className={`
            px-4 py-2 rounded-xl text-sm font-medium
            transition-all duration-200
            ${isOn 
              ? "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)]" 
              : "text-white hover:opacity-90"
            }
          `}
          style={!isOn ? { backgroundColor: accentColor } : {}}
        >
          {isOn ? "Turn Off" : "Turn On"}
        </button>
      </div>
    </Card>
  );
}

export default EquipmentCard;


