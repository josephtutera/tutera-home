"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Sun, Power } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import type { Light } from "@/lib/crestron/types";
import { setLightState } from "@/stores/deviceStore";

interface LightCardProps {
  light: Light;
  compact?: boolean;
}

// Convert 0-65535 to 0-100
function levelToPercent(level: number): number {
  return Math.round((level / 65535) * 100);
}

// Convert 0-100 to 0-65535
function percentToLevel(percent: number): number {
  return Math.round((percent / 100) * 65535);
}

export function LightCard({ light, compact = false }: LightCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const percent = levelToPercent(light.level);
  const isOn = light.isOn || light.level > 0;

  const handleToggle = useCallback(async (checked: boolean) => {
    setIsUpdating(true);
    await setLightState(light.id, undefined, checked);
    setIsUpdating(false);
  }, [light.id]);

  const handleLevelChange = useCallback(async (values: number[]) => {
    const newLevel = percentToLevel(values[0]);
    await setLightState(light.id, newLevel);
  }, [light.id]);

  if (compact) {
    return (
      <Card
        hoverable
        padding="sm"
        className={`
          transition-all duration-300
          ${isOn ? "bg-[var(--light-color)]/10 border-[var(--light-color)]/30" : ""}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                transition-all duration-300
                ${isOn ? "bg-[var(--light-color)] text-white" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"}
              `}
            >
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {light.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {isOn ? `${percent}%` : "Off"}
              </p>
            </div>
          </div>
          <Toggle
            checked={isOn}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
            size="sm"
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      padding="md"
      className={`
        transition-all duration-300
        ${isOn ? "bg-[var(--light-color)]/10 border-[var(--light-color)]/30" : ""}
      `}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              backgroundColor: isOn ? "var(--light-color)" : "var(--surface-hover)",
              scale: isOn ? 1 : 0.95,
            }}
            className="w-12 h-12 rounded-xl flex items-center justify-center"
          >
            <Lightbulb className={`w-6 h-6 ${isOn ? "text-white" : "text-[var(--text-tertiary)]"}`} />
          </motion.div>
          <div>
            <CardTitle>{light.name}</CardTitle>
            <p className="text-sm text-[var(--text-secondary)]">
              {light.subType === "dimmer" ? "Dimmable" : "Switch"}
            </p>
          </div>
        </div>
        <Toggle
          checked={isOn}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
        />
      </CardHeader>

      {light.subType === "dimmer" && (
        <div className="mt-4">
          <Slider
            value={[percent]}
            onValueCommit={handleLevelChange}
            min={0}
            max={100}
            step={1}
            disabled={isUpdating}
            showValue
            formatValue={(v) => `${v}%`}
            color="warning"
          />
        </div>
      )}

      {/* Visual brightness indicator */}
      {isOn && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center gap-2 text-[var(--text-secondary)]"
        >
          <Sun className="w-4 h-4" />
          <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--light-color)] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}
    </Card>
  );
}

// Light group control (all lights in room)
interface LightGroupControlProps {
  lights: Light[];
  roomName?: string;
}

export function LightGroupControl({ lights, roomName }: LightGroupControlProps) {
  const onCount = lights.filter(l => l.isOn || l.level > 0).length;
  const allOn = onCount === lights.length;
  const allOff = onCount === 0;

  const handleAllOff = async () => {
    for (const light of lights) {
      if (light.isOn || light.level > 0) {
        await setLightState(light.id, 0, false);
      }
    }
  };

  const handleAllOn = async () => {
    for (const light of lights) {
      if (!light.isOn && light.level === 0) {
        await setLightState(light.id, 65535, true);
      }
    }
  };

  return (
    <Card padding="sm" className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--light-color)]/20 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-[var(--light-color)]" />
        </div>
        <div>
          <p className="font-medium text-sm">
            {roomName ? `${roomName} Lights` : "All Lights"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {onCount} of {lights.length} on
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleAllOff}
          disabled={allOff}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${allOff 
              ? "bg-[var(--surface-hover)] text-[var(--text-tertiary)] cursor-not-allowed" 
              : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          All Off
        </button>
        <button
          onClick={handleAllOn}
          disabled={allOn}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${allOn
              ? "bg-[var(--light-color)]/50 text-white cursor-not-allowed"
              : "bg-[var(--light-color)] text-white hover:bg-[var(--light-color)]/90"
            }
          `}
        >
          All On
        </button>
      </div>
    </Card>
  );
}

export default LightCard;

