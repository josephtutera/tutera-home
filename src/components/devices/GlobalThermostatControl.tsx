"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Thermometer,
  Minus,
  Plus,
  Flame,
  Snowflake,
  CloudSun,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Thermostat, ThermostatMode } from "@/lib/crestron/types";
import { isFloorHeat } from "@/lib/crestron/types";
import { setAllThermostatsTemp, setThermostatMode, setThermostatSetPoint } from "@/stores/deviceStore";
import { useWeatherStore, fetchWeather, determineMode, getModeRecommendation } from "@/stores/weatherStore";

interface GlobalThermostatControlProps {
  thermostats: Thermostat[];
}

export function GlobalThermostatControl({ thermostats }: GlobalThermostatControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { outsideTemp, isLoading: weatherLoading } = useWeatherStore();
  
  // Fetch weather on mount
  useEffect(() => {
    fetchWeather();
  }, []);
  
  // Calculate average current temperature and setpoint
  const { avgCurrentTemp, avgSetPoint, activeCount } = useMemo(() => {
    const activeThermostats = thermostats.filter(t => t.mode !== 'off');
    
    if (activeThermostats.length === 0) {
      return { 
        avgCurrentTemp: Math.round(thermostats.reduce((sum, t) => sum + t.currentTemp, 0) / thermostats.length) || 0,
        avgSetPoint: 70, 
        activeCount: 0 
      };
    }
    
    const totalCurrent = thermostats.reduce((sum, t) => sum + t.currentTemp, 0);
    const totalSetPoint = activeThermostats.reduce((sum, t) => {
      return sum + (t.mode === 'heat' ? t.heatSetPoint : t.coolSetPoint);
    }, 0);
    
    return {
      avgCurrentTemp: Math.round(totalCurrent / thermostats.length),
      avgSetPoint: Math.round(totalSetPoint / activeThermostats.length),
      activeCount: activeThermostats.length,
    };
  }, [thermostats]);

  const [targetTemp, setTargetTemp] = useState(avgSetPoint);

  // Determine recommended mode based on outside temperature
  const recommendedMode = useMemo(() => {
    if (outsideTemp === null) return null;
    return determineMode(outsideTemp, targetTemp);
  }, [outsideTemp, targetTemp]);

  // Get mode recommendation text
  const modeRecommendationText = useMemo(() => {
    if (outsideTemp === null) return null;
    return getModeRecommendation(outsideTemp, targetTemp);
  }, [outsideTemp, targetTemp]);

  // Track if local target differs from average (user is adjusting)
  const hasUnsavedChanges = targetTemp !== avgSetPoint;

  const handleTempChange = useCallback((delta: number) => {
    setTargetTemp(prev => {
      const newTemp = prev + delta;
      // Clamp between reasonable range
      return Math.max(50, Math.min(90, newTemp));
    });
  }, []);

  const handleApplyToAll = useCallback(async () => {
    setIsUpdating(true);
    // Apply with the recommended mode (turns on off thermostats)
    const success = await setAllThermostatsTemp(targetTemp, recommendedMode ?? undefined);
    if (!success) {
      // Reset to average on failure
      setTargetTemp(avgSetPoint);
    }
    setIsUpdating(false);
  }, [targetTemp, avgSetPoint, recommendedMode]);

  // Handler for applying preset configurations
  const handlePresetApply = useCallback(async (preset: { mode: ThermostatMode; heatSetPoint?: number; coolSetPoint?: number; displayTemp: number }) => {
    setIsUpdating(true);
    try {
      const mainThermostats = thermostats.filter(t => !isFloorHeat(t));
      
      // First set the mode for all main thermostats
      await Promise.all(mainThermostats.map(t => setThermostatMode(t.id, preset.mode)));
      
      // Then set the setpoints
      await Promise.all(mainThermostats.map(t => 
        setThermostatSetPoint(t.id, preset.heatSetPoint, preset.coolSetPoint)
      ));
      
      // Update local target temp for display
      setTargetTemp(preset.displayTemp);
    } catch (error) {
      console.error("Failed to apply preset:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [thermostats]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetTemp(parseInt(e.target.value, 10));
  }, []);

  // Calculate temperature gradient color
  const getTempColor = (temp: number) => {
    if (temp <= 65) return "#3B82F6"; // Blue - cool
    if (temp <= 72) return "#10B981"; // Green - comfortable
    if (temp <= 78) return "#F59E0B"; // Orange - warm
    return "#EF4444"; // Red - hot
  };

  const tempColor = getTempColor(targetTemp);
  
  // Mode icon and color
  const ModeIcon = recommendedMode === "heat" ? Flame : recommendedMode === "cool" ? Snowflake : CloudSun;
  const modeColor = recommendedMode === "heat" ? "#EF4444" : recommendedMode === "cool" ? "#3B82F6" : "#10B981";

  return (
    <Card padding="lg" className="bg-gradient-to-br from-[var(--climate-color)]/10 to-[var(--climate-color)]/5 border-[var(--climate-color)]/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--climate-color)] flex items-center justify-center shadow-lg shadow-[var(--climate-color)]/30">
            <Thermometer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Whole Home Temperature
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {activeCount > 0 
                ? `${activeCount} of ${thermostats.length} thermostats active`
                : `${thermostats.length} thermostats (all off)`
              }
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-light text-[var(--text-primary)]">
            {avgCurrentTemp}°
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">Avg Inside</p>
        </div>
      </div>

      {/* Outside Temperature & Mode Recommendation */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${modeColor}20` }}
          >
            <CloudSun className="w-5 h-5" style={{ color: modeColor }} />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {outsideTemp !== null ? `${outsideTemp}°F Outside` : weatherLoading ? "Loading..." : "Weather unavailable"}
            </p>
            {modeRecommendationText && (
              <p className="text-xs text-[var(--text-secondary)]">
                {recommendedMode === "heat" ? "🔥" : "❄️"} {recommendedMode === "heat" ? "Heating" : "Cooling"} recommended
              </p>
            )}
          </div>
        </div>
        {recommendedMode && (
          <div 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${modeColor}20`, color: modeColor }}
          >
            <ModeIcon className="w-3.5 h-3.5" />
            {recommendedMode === "heat" ? "Heat" : "Cool"}
          </div>
        )}
      </div>

      {/* Temperature Slider Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-6">
          {/* Decrease Button */}
          <button
            onClick={() => handleTempChange(-1)}
            disabled={isUpdating || targetTemp <= 50}
            className="w-12 h-12 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] 
                     flex items-center justify-center transition-colors disabled:opacity-50
                     shadow-sm border border-[var(--border)]"
          >
            <Minus className="w-5 h-5 text-[var(--text-primary)]" />
          </button>

          {/* Target Temperature Display */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span 
                className="text-6xl font-light transition-colors"
                style={{ color: tempColor }}
              >
                {targetTemp}
              </span>
              <span className="text-3xl text-[var(--text-tertiary)]">°F</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Set All Thermostats
            </p>
          </div>

          {/* Increase Button */}
          <button
            onClick={() => handleTempChange(1)}
            disabled={isUpdating || targetTemp >= 90}
            className="w-12 h-12 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] 
                     flex items-center justify-center transition-colors disabled:opacity-50
                     shadow-sm border border-[var(--border)]"
          >
            <Plus className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
        </div>

        {/* Temperature Slider */}
        <div className="px-4">
          <input
            type="range"
            min="50"
            max="90"
            value={targetTemp}
            onChange={handleSliderChange}
            disabled={isUpdating}
            className="w-full h-2 rounded-full appearance-none cursor-pointer
                     bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-6
                     [&::-webkit-slider-thumb]:h-6
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:shadow-lg
                     [&::-webkit-slider-thumb]:border-2
                     [&::-webkit-slider-thumb]:border-[var(--border)]
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:w-6
                     [&::-moz-range-thumb]:h-6
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-white
                     [&::-moz-range-thumb]:shadow-lg
                     [&::-moz-range-thumb]:border-2
                     [&::-moz-range-thumb]:border-[var(--border)]
                     [&::-moz-range-thumb]:cursor-pointer
                     disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
            <span>50°</span>
            <span>70°</span>
            <span>90°</span>
          </div>
        </div>

        {/* Apply Button */}
        {hasUnsavedChanges && (
          <button
            onClick={handleApplyToAll}
            disabled={isUpdating}
            className={`
              w-full py-3 px-4 rounded-xl font-medium text-white
              transition-all duration-200 shadow-lg flex items-center justify-center gap-2
              ${isUpdating 
                ? "bg-[var(--text-tertiary)] cursor-not-allowed" 
                : "bg-[var(--climate-color)] hover:bg-[var(--climate-color)]/90 shadow-[var(--climate-color)]/30"
              }
            `}
            style={!isUpdating && recommendedMode ? { backgroundColor: modeColor } : undefined}
          >
            {isUpdating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating all thermostats...
              </>
            ) : (
              <>
                <ModeIcon className="w-4 h-4" />
                Set All to {targetTemp}° ({recommendedMode === "heat" ? "Heat" : recommendedMode === "cool" ? "Cool" : "Auto"})
              </>
            )}
          </button>
        )}

        {/* Quick Presets */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { label: "Energy Saver", mode: "auto" as ThermostatMode, heatSetPoint: 60, coolSetPoint: 80, displayTemp: 60 },
            { label: "Comfort", mode: "auto" as ThermostatMode, heatSetPoint: 70, coolSetPoint: 70, displayTemp: 70 },
            { label: "Warm", mode: "cool" as ThermostatMode, coolSetPoint: 76, displayTemp: 76 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetApply(preset)}
              disabled={isUpdating}
              className={`
                py-2 px-3 rounded-xl text-xs font-medium
                transition-all duration-200
                ${targetTemp === preset.displayTemp
                  ? "bg-[var(--climate-color)]/20 text-[var(--climate-color)] border border-[var(--climate-color)]/30"
                  : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }
              `}
            >
              <span className="block font-semibold">{preset.displayTemp}°</span>
              <span className="block opacity-70">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default GlobalThermostatControl;
