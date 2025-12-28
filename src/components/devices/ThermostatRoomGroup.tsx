"use client";

import { useState, useCallback } from "react";
import {
  Thermometer,
  Flame,
  Snowflake,
  Wind,
  Power,
  ChevronUp,
  ChevronDown,
  Fan,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ThermostatPair, ThermostatMode, FanMode } from "@/lib/crestron/types";
import { isTemperatureSatisfied } from "@/lib/crestron/types";
import { 
  setThermostatSetPoint, 
  setRoomThermostatMode,
  setFloorHeatMode,
  setThermostatFanMode,
} from "@/stores/deviceStore";

interface ThermostatRoomGroupProps {
  pair: ThermostatPair;
}

const modeConfig = {
  off: { icon: Power, color: "var(--text-tertiary)", label: "Off" },
  heat: { icon: Flame, color: "#EF4444", label: "Heat" },
  cool: { icon: Snowflake, color: "#3B82F6", label: "Cool" },
  auto: { icon: Wind, color: "#10B981", label: "Auto" },
};

export function ThermostatRoomGroup({ pair }: ThermostatRoomGroupProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { mainThermostat, floorHeat, roomName } = pair;
  
  const mode = mainThermostat.mode || "off";
  const config = modeConfig[mode];
  const ModeIcon = config.icon;
  
  const currentSetPoint = mode === "heat" 
    ? mainThermostat.heatSetPoint 
    : mode === "cool" 
      ? mainThermostat.coolSetPoint 
      : mainThermostat.heatSetPoint;

  // Check if temperature is satisfied
  const isSatisfied = isTemperatureSatisfied(mainThermostat);
  
  // Floor heat status
  const floorHeatActive = floorHeat && floorHeat.mode === 'heat';

  const handleSetPointChange = useCallback(async (delta: number) => {
    setIsUpdating(true);
    const newSetPoint = currentSetPoint + delta;
    
    // Update main thermostat
    if (mode === "heat") {
      await setThermostatSetPoint(mainThermostat.id, newSetPoint, undefined);
    } else if (mode === "cool") {
      await setThermostatSetPoint(mainThermostat.id, undefined, newSetPoint);
    } else {
      await setThermostatSetPoint(mainThermostat.id, newSetPoint, newSetPoint);
    }
    
    // Also update floor heat setpoint if present
    if (floorHeat) {
      await setThermostatSetPoint(floorHeat.id, newSetPoint, undefined);
    }
    
    setIsUpdating(false);
  }, [mainThermostat.id, floorHeat, mode, currentSetPoint]);

  const handleModeChange = useCallback(async (newMode: ThermostatMode) => {
    setIsUpdating(true);
    await setRoomThermostatMode(
      mainThermostat.id, 
      floorHeat?.id || null, 
      newMode
    );
    setIsUpdating(false);
  }, [mainThermostat.id, floorHeat?.id]);

  const handleFloorHeatToggle = useCallback(async () => {
    if (!floorHeat) return;
    setIsUpdating(true);
    
    const newMode: ThermostatMode = floorHeat.mode === 'heat' ? 'off' : 'heat';
    await setFloorHeatMode(
      floorHeat.id,
      mainThermostat.id,
      newMode
    );
    
    setIsUpdating(false);
  }, [floorHeat, mainThermostat.id]);

  const handleFanModeChange = useCallback(async (newFanMode: FanMode) => {
    if (newFanMode === mainThermostat.fanMode) return;
    setIsUpdating(true);
    await setThermostatFanMode(mainThermostat.id, newFanMode);
    setIsUpdating(false);
  }, [mainThermostat.id, mainThermostat.fanMode]);

  return (
    <Card padding="lg" className="bg-gradient-to-br from-[var(--climate-color)]/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--climate-color)]/20 flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-[var(--climate-color)]" />
            </div>
            <div>
              <CardTitle>{roomName}</CardTitle>
              <p className="text-sm text-[var(--text-secondary)]">
                {floorHeat ? "Thermostat + Floor Heat" : mainThermostat.name}
              </p>
            </div>
          </div>
          {isSatisfied && mode !== 'off' && (
            <div className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
              Target Reached
            </div>
          )}
        </div>
      </CardHeader>

      {/* Temperature Display */}
      <div className="mt-6 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-4">
            {/* Current Temperature */}
            <div>
              <p className="text-5xl font-light text-[var(--text-primary)]">
                {mainThermostat.currentTemp}°
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Current</p>
            </div>
            
            {/* Divider */}
            <div className="w-px h-16 bg-[var(--border)]" />
            
            {/* Set Point with Controls */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleSetPointChange(1)}
                disabled={isUpdating || mode === "off"}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <p className="text-3xl font-semibold" style={{ color: config.color }}>
                {currentSetPoint}°
              </p>
              <button
                onClick={() => handleSetPointChange(-1)}
                disabled={isUpdating || mode === "off"}
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
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(modeConfig) as ThermostatMode[]).map((modeKey) => {
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

      {/* Floor Heat Toggle (if present) */}
      {floorHeat && (
        <div className="mt-4">
          <button
            onClick={handleFloorHeatToggle}
            disabled={isUpdating || mainThermostat.mode === 'cool' || mainThermostat.mode === 'off'}
            className={`
              w-full flex items-center justify-between p-3 rounded-xl
              transition-all duration-200
              ${floorHeatActive 
                ? "bg-orange-500/20 border border-orange-500/30" 
                : "bg-[var(--surface-hover)]"
              }
              disabled:opacity-50
            `}
          >
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${floorHeatActive ? "text-orange-500" : "text-[var(--text-secondary)]"}`} />
              <span className={`text-sm font-medium ${floorHeatActive ? "text-orange-500" : "text-[var(--text-secondary)]"}`}>
                Floor Heat
              </span>
            </div>
            <div className="flex items-center gap-2">
              {floorHeat.currentTemp && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  {floorHeat.currentTemp}°
                </span>
              )}
              <div className={`
                w-10 h-6 rounded-full p-1 transition-colors duration-200
                ${floorHeatActive ? "bg-orange-500" : "bg-[var(--surface)]"}
              `}>
                <div className={`
                  w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                  ${floorHeatActive ? "translate-x-4" : "translate-x-0"}
                `} />
              </div>
            </div>
          </button>
          {(mainThermostat.mode === 'cool' || mainThermostat.mode === 'off') && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1 text-center">
              Floor heat is disabled when {mainThermostat.mode === 'cool' ? 'cooling' : 'thermostat is off'}
            </p>
          )}
        </div>
      )}

      {/* Fan Mode */}
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
              ${mainThermostat.fanMode === "auto" 
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
              ${mainThermostat.fanMode === "on" 
                ? "bg-[var(--accent)] text-white" 
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }
            `}
          >
            On
          </button>
        </div>
      </div>
    </Card>
  );
}

export default ThermostatRoomGroup;


