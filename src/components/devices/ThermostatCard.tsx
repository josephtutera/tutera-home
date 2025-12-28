"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Thermometer,
  Flame,
  Snowflake,
  Wind,
  Power,
  ChevronUp,
  ChevronDown,
  Fan,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Thermostat, ThermostatMode, FanMode } from "@/lib/crestron/types";
import { setThermostatSetPoint, setThermostatMode, setThermostatFanMode } from "@/stores/deviceStore";

interface ThermostatCardProps {
  thermostat: Thermostat;
  compact?: boolean;
  isFloorHeatOnly?: boolean;
}

const modeConfig = {
  off: { icon: Power, color: "var(--text-tertiary)", label: "Off" },
  heat: { icon: Flame, color: "#EF4444", label: "Heat" },
  cool: { icon: Snowflake, color: "#3B82F6", label: "Cool" },
  auto: { icon: Wind, color: "#10B981", label: "Auto" },
};

// Floor heat only supports Off and Heat modes
const floorHeatModes: ThermostatMode[] = ["off", "heat"];

export function ThermostatCard({ thermostat, compact = false, isFloorHeatOnly = false }: ThermostatCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const mode = thermostat.mode || "off";
  const config = modeConfig[mode];
  const ModeIcon = config.icon;
  
  // Use a ref to always access the latest thermostat data in callbacks
  const thermostatRef = useRef(thermostat);
  useEffect(() => {
    thermostatRef.current = thermostat;
  }, [thermostat]);
  
  const currentSetPoint = mode === "heat" 
    ? thermostat.heatSetPoint 
    : mode === "cool" 
      ? thermostat.coolSetPoint 
      : thermostat.heatSetPoint; // Default to heat for display

  const handleSetPointChange = useCallback(async (delta: number) => {
    setIsUpdating(true);
    
    // Get the latest thermostat data from ref
    const latest = thermostatRef.current;
    const latestMode = latest.mode || "off";
    const latestSetPoint = latestMode === "heat" 
      ? latest.heatSetPoint 
      : latestMode === "cool" 
        ? latest.coolSetPoint 
        : latest.heatSetPoint;
    
    const newSetPoint = latestSetPoint + delta;
    
    if (latestMode === "heat") {
      await setThermostatSetPoint(latest.id, newSetPoint, undefined);
    } else if (latestMode === "cool") {
      await setThermostatSetPoint(latest.id, undefined, newSetPoint);
    } else {
      await setThermostatSetPoint(latest.id, newSetPoint, newSetPoint);
    }
    
    setIsUpdating(false);
  }, []);

  const handleModeChange = useCallback(async (newMode: ThermostatMode) => {
    setIsUpdating(true);
    await setThermostatMode(thermostatRef.current.id, newMode);
    setIsUpdating(false);
  }, []);

  const handleFanModeChange = useCallback(async (newFanMode: FanMode) => {
    if (newFanMode === thermostatRef.current.fanMode) return;
    setIsUpdating(true);
    await setThermostatFanMode(thermostatRef.current.id, newFanMode);
    setIsUpdating(false);
  }, []);

  if (compact) {
    return (
      <Card
        hoverable
        padding="sm"
        className="bg-gradient-to-br from-[var(--climate-color)]/5 to-transparent"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--climate-color)]/20 flex items-center justify-center shrink-0">
              <Thermometer className="w-5 h-5 text-[var(--climate-color)]" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {thermostat.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {thermostat.currentTemp}° • {config.label}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-[var(--text-primary)]">
              {currentSetPoint}°
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="bg-gradient-to-br from-[var(--climate-color)]/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--climate-color)]/20 flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-[var(--climate-color)]" />
          </div>
          <div>
            <CardTitle>{thermostat.name}</CardTitle>
            <p className="text-sm text-[var(--text-secondary)]">
              {thermostat.humidity !== undefined && `${thermostat.humidity}% humidity`}
            </p>
          </div>
        </div>
      </CardHeader>

      {/* Temperature Display */}
      <div className="mt-6 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-4">
            {/* Current Temperature */}
            <div>
              <p className="text-5xl font-light text-[var(--text-primary)]">
                {thermostat.currentTemp}°
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Current</p>
            </div>
            
            {/* Divider */}
            <div className="w-px h-16 bg-[var(--border)]" />
            
            {/* Set Point with Controls */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleSetPointChange(1)}
                disabled={isUpdating}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <p 
                className="text-3xl font-semibold" 
                style={{ color: mode === "off" ? "#EAB308" : config.color }}
              >
                {currentSetPoint}°
              </p>
              <button
                onClick={() => handleSetPointChange(-1)}
                disabled={isUpdating}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <p className="text-sm text-[var(--text-secondary)]">Target</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="mt-6">
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">MODE</p>
        <div className={`grid gap-2 ${isFloorHeatOnly ? "grid-cols-2" : "grid-cols-4"}`}>
          {(isFloorHeatOnly ? floorHeatModes : Object.keys(modeConfig) as ThermostatMode[]).map((modeKey) => {
            const modeItem = modeConfig[modeKey];
            const ModeItemIcon = modeItem.icon;
            const isSelected = mode === modeKey;
            
            return (
              <button
                key={modeKey}
                onClick={() => handleModeChange(modeKey)}
                disabled={isUpdating}
                className={`
                  flex flex-col items-center gap-1 py-3 rounded-xl
                  transition-all duration-200
                  ${isSelected 
                    ? "bg-[var(--surface)] shadow-sm" 
                    : "hover:bg-[var(--surface-hover)]"
                  }
                `}
              >
                <ModeItemIcon 
                  className="w-5 h-5" 
                  style={{ color: isSelected ? modeItem.color : "var(--text-tertiary)" }}
                />
                <span 
                  className="text-xs font-medium"
                  style={{ color: isSelected ? modeItem.color : "var(--text-secondary)" }}
                >
                  {modeItem.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fan Mode - Not shown for floor heat only */}
      {!isFloorHeatOnly && (
        <div className="mt-4 flex items-center justify-between p-3 bg-[var(--surface-hover)] rounded-xl">
          <div className="flex items-center gap-2">
            <Fan className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)]">Fan</span>
          </div>
          <div className="flex items-center gap-1 bg-[var(--surface)] rounded-lg p-1">
            <button
              onClick={() => handleFanModeChange("auto")}
              disabled={isUpdating || mode === "off"}
              className={`
                px-3 py-1 rounded-md text-xs font-medium transition-colors
                disabled:opacity-50
                ${thermostat.fanMode === "auto" 
                  ? "bg-[var(--accent)] text-white" 
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }
              `}
            >
              Auto
            </button>
            <button
              onClick={() => handleFanModeChange("on")}
              disabled={isUpdating || mode === "off"}
              className={`
                px-3 py-1 rounded-md text-xs font-medium transition-colors
                disabled:opacity-50
                ${thermostat.fanMode === "on" 
                  ? "bg-[var(--accent)] text-white" 
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }
              `}
            >
              On
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default ThermostatCard;
