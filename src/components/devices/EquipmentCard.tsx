"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fan, Flame, Waves, Droplets, Power, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Light } from "@/lib/crestron/types";
import { setLightState, useDeviceStore } from "@/stores/deviceStore";
import { useShallow } from "zustand/react/shallow";

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
  
  // Subscribe to the store directly to get the latest equipment state
  // This ensures updates are reflected immediately regardless of parent re-renders
  const storeLight = useDeviceStore(
    (state) => state.lights.find((l) => l.id === equipment.id)
  );
  
  // Use store light if available, otherwise fall back to prop
  const currentEquipment = storeLight || equipment;
  
  const isOn = currentEquipment.isOn || currentEquipment.level > 0;
  const Icon = getEquipmentIcon(equipment.name);
  const accentColor = getEquipmentColor(equipment.name);

  const handleToggle = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    if (isOn) {
      await setLightState(currentEquipment.id, 0, false);
    } else {
      await setLightState(currentEquipment.id, 65535, true);
    }
    setIsUpdating(false);
  }, [currentEquipment.id, isUpdating, isOn]);

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

// Get appropriate icon based on equipment name (exported for use elsewhere)
export { getEquipmentIcon, getEquipmentColor };

interface EquipmentGroupControlProps {
  equipment: Light[];
  standalone?: boolean;
}

export function EquipmentGroupControl({ equipment, standalone = true }: EquipmentGroupControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const onCount = equipment.filter(e => e.isOn || e.level > 0).length;
  const totalEquipment = equipment.length;
  
  const handleAllEquipment = useCallback(async (turnOn: boolean) => {
    setIsUpdating(true);
    
    for (const equip of equipment) {
      await setLightState(equip.id, turnOn ? 65535 : 0, turnOn);
    }
    setIsUpdating(false);
  }, [equipment]);

  // Non-standalone: just render buttons
  if (!standalone) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAllEquipment(false);
          }}
          disabled={onCount === 0 || isUpdating}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${onCount === 0 
              ? "bg-[var(--surface-hover)] text-[var(--text-tertiary)] cursor-not-allowed" 
              : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          All Off
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAllEquipment(true);
          }}
          disabled={onCount === totalEquipment || isUpdating}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${onCount === totalEquipment
              ? "bg-[var(--accent)]/50 text-white cursor-not-allowed"
              : "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
            }
          `}
        >
          All On
        </button>
      </div>
    );
  }

  // Standalone: just buttons in a card (equipment doesn't have dimming)
  return (
    <Card padding="md" className="bg-[var(--surface)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center">
            <Power className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              {onCount} of {totalEquipment} on
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Equipment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAllEquipment(false)}
            disabled={onCount === 0 || isUpdating}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium
              transition-all duration-200
              ${onCount === 0 
                ? "bg-[var(--surface-hover)] text-[var(--text-tertiary)] cursor-not-allowed" 
                : "bg-[var(--surface-hover)] text-[var(--text-primary)] hover:bg-[var(--surface-active)]"
              }
            `}
          >
            All Off
          </button>
          <button
            onClick={() => handleAllEquipment(true)}
            disabled={onCount === totalEquipment || isUpdating}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium
              transition-all duration-200
              ${onCount === totalEquipment
                ? "bg-[var(--accent)]/50 text-white cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
              }
            `}
          >
            All On
          </button>
        </div>
      </div>
    </Card>
  );
}

interface EquipmentByRoom {
  roomId: string;
  roomName: string;
  equipment: Light[];
}

interface EquipmentSummaryCardProps {
  equipment: Light[];
  equipmentByRoom: EquipmentByRoom[] | null;
}

export function EquipmentSummaryCard({ equipment, equipmentByRoom }: EquipmentSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Get equipment IDs for stable selector
  const equipmentIds = useMemo(() => equipment.map(e => e.id), [equipment]);
  
  // Subscribe to store to get real-time updates with shallow comparison
  const storeLights = useDeviceStore(
    useShallow((state) => state.lights.filter(l => equipmentIds.includes(l.id)))
  );
  
  // Merge with passed equipment for any not found in store
  const storeEquipment = useMemo(() => {
    return equipment.map(e => storeLights.find(l => l.id === e.id) || e);
  }, [equipment, storeLights]);
  
  const onCount = storeEquipment.filter(e => e.isOn || e.level > 0).length;
  const totalEquipment = storeEquipment.length;
  
  const handleAllEquipment = useCallback(async (turnOn: boolean) => {
    setIsUpdating(true);
    
    for (const equip of equipment) {
      await setLightState(equip.id, turnOn ? 65535 : 0, turnOn);
    }
    setIsUpdating(false);
  }, [equipment]);

  return (
    <Card 
      padding="md" 
      className="bg-gradient-to-br from-[var(--accent)]/5 to-transparent relative overflow-hidden"
    >
      {/* Summary header - clickable to expand */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <motion.div 
            animate={{
              backgroundColor: onCount > 0 ? "var(--accent)" : "rgba(var(--accent-rgb), 0.2)",
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
          >
            <Power className={`w-5 h-5 ${onCount > 0 ? "text-white" : "text-[var(--accent)]"}`} />
          </motion.div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              {onCount} of {totalEquipment} on
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {totalEquipment} equipment items
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* All On/Off buttons */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleAllEquipment(false)}
              disabled={onCount === 0 || isUpdating}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200
                ${onCount === 0 
                  ? "bg-[var(--surface-hover)] text-[var(--text-tertiary)] cursor-not-allowed" 
                  : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                }
              `}
            >
              All Off
            </button>
            <button
              onClick={() => handleAllEquipment(true)}
              disabled={onCount === totalEquipment || isUpdating}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200
                ${onCount === totalEquipment
                  ? "bg-[var(--accent)]/50 text-white cursor-not-allowed"
                  : "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
                }
              `}
            >
              All On
            </button>
          </div>
          
          {/* Expand chevron */}
          <button className="p-1 hover:bg-[var(--surface-hover)] rounded-lg transition-colors">
            {expanded ? (
              <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content - equipment by room */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-[var(--border-light)]"
          >
            {equipmentByRoom && equipmentByRoom.length > 0 ? (
              <div className="space-y-4">
                {equipmentByRoom.map(({ roomId, roomName, equipment: roomEquip }) => (
                  <div key={roomId} className="space-y-2">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">{roomName}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                      {roomEquip.map((equip) => (
                        <EquipmentCard key={equip.id} equipment={equip} compact roomName={roomName} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {equipment.map((equip) => (
                  <EquipmentCard key={equip.id} equipment={equip} compact />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}


