"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Thermometer,
  Minus,
  Plus,
  Flame,
  Snowflake,
  Wind,
  Power,
  Fan,
  Calendar,
  Home,
  Building2,
  ChevronDown,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ThermostatCard } from "@/components/devices/ThermostatCard";
import type { ThermostatZoneWithData, ThermostatMode, FanMode, Thermostat, ThermostatPair } from "@/lib/crestron/types";
import { isFloorHeat } from "@/lib/crestron/types";
import { 
  setZoneThermostatMode,
  setZoneThermostatFanMode,
  setZoneThermostatTemp,
  useDeviceStore,
  getThermostatPairs,
} from "@/stores/deviceStore";
import { useWeatherStore, fetchWeather, determineMode } from "@/stores/weatherStore";

interface ThermostatZoneControlProps {
  zoneData: ThermostatZoneWithData;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const modeConfig = {
  off: { icon: Power, color: "var(--text-tertiary)", label: "Off", bgColor: "var(--surface)" },
  heat: { icon: Flame, color: "#EF4444", label: "Heat", bgColor: "#FEE2E2" },
  cool: { icon: Snowflake, color: "#3B82F6", label: "Cool", bgColor: "#DBEAFE" },
  auto: { icon: Wind, color: "#10B981", label: "Auto", bgColor: "#D1FAE5" },
};

const fanModeConfig = {
  auto: { label: "Auto" },
  on: { label: "On" },
};

export function ThermostatZoneControl({ 
  zoneData, 
  expanded = false,
  onToggleExpand 
}: ThermostatZoneControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [targetTemp, setTargetTemp] = useState(zoneData.avgSetPoint);
  const [selectedThermostatId, setSelectedThermostatId] = useState<string | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const { outsideTemp, isLoading: weatherLoading } = useWeatherStore();
  const { rooms, thermostats: allThermostats, areas } = useDeviceStore();
  
  // Get the current thermostat data from store (live updates)
  const selectedThermostat = useMemo(() => {
    if (!selectedThermostatId) return null;
    return allThermostats.find(t => t.id === selectedThermostatId) || null;
  }, [selectedThermostatId, allThermostats]);
  
  const { zone, thermostats, avgCurrentTemp, avgSetPoint, dominantMode, dominantFanMode, activeCount } = zoneData;
  
  // Create a map of roomId to room name for display
  const roomNameMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => map.set(room.id, room.name));
    return map;
  }, [rooms]);
  
  // Create a map of roomId to area name for sorting
  const roomToAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    areas.forEach(area => {
      area.roomIds.forEach(roomId => {
        map.set(roomId, area.name);
      });
    });
    return map;
  }, [areas]);
  
  // Zone display order - lower number = higher priority
  // Order: 1st Floor → Master Suite → 2nd Floor → Lower Level
  const ZONE_ORDER: Record<string, number> = useMemo(() => ({
    "1st floor": 1,
    "master suite": 2,
    "2nd floor": 3,
    "lower level": 4,
    "exterior": 5,
    "infrastructure": 6,
  }), []);
  
  const getAreaOrder = useCallback((areaName: string): number => {
    const normalized = areaName.toLowerCase().trim();
    return ZONE_ORDER[normalized] ?? 99;
  }, [ZONE_ORDER]);
  
  // Separate main thermostats and floor heat thermostats
  const mainThermostats = useMemo(() => thermostats.filter(t => !isFloorHeat(t)), [thermostats]);
  const floorHeatThermostats = useMemo(() => thermostats.filter(t => isFloorHeat(t)), [thermostats]);
  
  // Find floor-heat-only rooms (rooms that have floor heat but no main thermostat)
  const floorHeatOnlyThermostats = useMemo(() => {
    const mainThermostatRoomIds = new Set(mainThermostats.map(t => t.roomId).filter(Boolean));
    return floorHeatThermostats.filter(t => !t.roomId || !mainThermostatRoomIds.has(t.roomId));
  }, [mainThermostats, floorHeatThermostats]);
  
  // Combined list for display: main thermostats + floor-heat-only thermostats, sorted by area order
  const displayThermostats = useMemo(() => {
    const combined = [...mainThermostats, ...floorHeatOnlyThermostats];
    
    // Sort by area order, then by room name
    return combined.sort((a, b) => {
      const areaA = a.roomId ? roomToAreaMap.get(a.roomId) || '' : '';
      const areaB = b.roomId ? roomToAreaMap.get(b.roomId) || '' : '';
      const orderA = getAreaOrder(areaA);
      const orderB = getAreaOrder(areaB);
      if (orderA !== orderB) return orderA - orderB;
      
      // Secondary sort by room name
      const roomA = roomNameMap.get(a.roomId || '') || a.name;
      const roomB = roomNameMap.get(b.roomId || '') || b.name;
      return roomA.localeCompare(roomB);
    });
  }, [mainThermostats, floorHeatOnlyThermostats, roomToAreaMap, roomNameMap, getAreaOrder]);
  
  const mainThermostatCount = mainThermostats.length;
  
  // Check if selected thermostat is floor-heat-only
  const isSelectedFloorHeatOnly = useMemo(() => {
    if (!selectedThermostat) return false;
    return isFloorHeat(selectedThermostat);
  }, [selectedThermostat]);
  
  // Get the paired floor heat for the selected thermostat (if it's a main thermostat)
  const selectedFloorHeat = useMemo(() => {
    if (!selectedThermostat?.roomId || isSelectedFloorHeatOnly) return null;
    return allThermostats.find(t => 
      t.roomId === selectedThermostat.roomId && isFloorHeat(t)
    ) || null;
  }, [selectedThermostat, allThermostats, isSelectedFloorHeatOnly]);
  
  // Handle room tile click
  const handleRoomClick = useCallback((thermostat: Thermostat) => {
    setSelectedThermostatId(thermostat.id);
    setIsRoomModalOpen(true);
  }, []);
  
  // Close the room modal
  const handleCloseRoomModal = useCallback(() => {
    setIsRoomModalOpen(false);
    // Delay clearing the thermostat so the exit animation completes
    setTimeout(() => setSelectedThermostatId(null), 200);
  }, []);
  
  // Get display name for a thermostat
  const getThermostatDisplayName = useCallback((t: Thermostat) => {
    // Get the base room name
    let roomName: string;
    if (t.roomId && roomNameMap.has(t.roomId)) {
      roomName = roomNameMap.get(t.roomId)!;
    } else {
      // Fall back to cleaning up the thermostat name
      roomName = t.name
        .replace(" Thermostat", "")
        .replace("Thermostat", "")
        .replace(" Floor Heat", "")
        .replace("Floor Heat", "")
        .trim() || "Unknown";
    }
    
    // If this is a floor-heat-only thermostat, append "Floor Heat"
    if (isFloorHeat(t)) {
      // Check if there's a main thermostat for this room
      const hasMainThermostat = mainThermostats.some(main => main.roomId === t.roomId);
      if (!hasMainThermostat) {
        return `${roomName} Floor Heat`;
      }
    }
    
    return roomName;
  }, [roomNameMap, mainThermostats]);
  
  // Sync local target temp with zone average when it changes externally
  useEffect(() => {
    setTargetTemp(avgSetPoint);
  }, [avgSetPoint]);
  
  // Fetch weather on mount
  useEffect(() => {
    fetchWeather();
  }, []);
  
  const config = modeConfig[dominantMode];
  const ModeIcon = config.icon;
  
  // Determine recommended mode based on outside temperature
  const recommendedMode = outsideTemp !== null ? determineMode(outsideTemp, targetTemp) : null;
  
  const hasUnsavedChanges = targetTemp !== avgSetPoint;
  
  const handleTempChange = useCallback((delta: number) => {
    setTargetTemp(prev => Math.max(50, Math.min(90, prev + delta)));
  }, []);
  
  const handleApplyTemp = useCallback(async () => {
    setIsUpdating(true);
    const success = await setZoneThermostatTemp(zone.id, targetTemp, recommendedMode ?? undefined);
    if (!success) {
      setTargetTemp(avgSetPoint);
    }
    setIsUpdating(false);
  }, [zone.id, targetTemp, avgSetPoint, recommendedMode]);
  
  const handleModeChange = useCallback(async (newMode: ThermostatMode) => {
    if (newMode === dominantMode) return;
    setIsUpdating(true);
    await setZoneThermostatMode(zone.id, newMode);
    setIsUpdating(false);
  }, [zone.id, dominantMode]);
  
  const handleFanModeChange = useCallback(async (newFanMode: FanMode) => {
    if (newFanMode === dominantFanMode) return;
    setIsUpdating(true);
    await setZoneThermostatFanMode(zone.id, newFanMode);
    setIsUpdating(false);
  }, [zone.id, dominantFanMode]);
  
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetTemp(parseInt(e.target.value, 10));
  }, []);
  
  // Calculate temperature gradient color
  const getTempColor = (temp: number) => {
    if (temp <= 65) return "#3B82F6";
    if (temp <= 72) return "#10B981";
    if (temp <= 78) return "#F59E0B";
    return "#EF4444";
  };
  
  const tempColor = getTempColor(targetTemp);
  
  // Icon for zone type
  const ZoneIcon = zone.id === "whole-house" ? Home : Building2;
  
  return (
    <Card 
      padding="lg" 
      className={`
        bg-gradient-to-br from-[var(--climate-color)]/10 to-[var(--climate-color)]/5 
        border-[var(--climate-color)]/20 transition-all duration-300
        ${expanded ? "ring-2 ring-[var(--climate-color)]/30" : ""}
      `}
    >
      {/* Zone Header */}
      <div 
        className={`flex items-center justify-between ${onToggleExpand ? "cursor-pointer" : ""}`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-colors"
            style={{ 
              backgroundColor: config.color,
              boxShadow: `0 4px 14px ${config.color}40`
            }}
          >
            <ZoneIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {zone.name}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {activeCount > 0 
                ? `${activeCount} of ${mainThermostatCount} thermostats active`
                : `${mainThermostatCount} thermostats (all off)`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-3xl font-light text-[var(--text-primary)]">
              {avgCurrentTemp}°
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Current Avg</p>
          </div>
          {onToggleExpand && (
            <ChevronDown 
              className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} 
            />
          )}
        </div>
      </div>
      
      {/* Expandable Content */}
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-6 opacity-100" : "max-h-0 opacity-0"}`}>
        {/* Mode Selection */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Mode</p>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(modeConfig) as ThermostatMode[]).map((modeKey) => {
              const modeItem = modeConfig[modeKey];
              const ModeItemIcon = modeItem.icon;
              const isSelected = dominantMode === modeKey;
              
              return (
                <button
                  key={modeKey}
                  onClick={(e) => { e.stopPropagation(); handleModeChange(modeKey); }}
                  disabled={isUpdating}
                  className={`
                    flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl
                    transition-all duration-200 relative overflow-hidden
                    ${isSelected 
                      ? "shadow-md scale-[1.02]" 
                      : "hover:bg-[var(--surface-hover)] hover:scale-[1.01]"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                  style={isSelected ? { backgroundColor: `${modeItem.color}15` } : undefined}
                >
                  {isSelected && (
                    <div 
                      className="absolute inset-0 opacity-10" 
                      style={{ backgroundColor: modeItem.color }}
                    />
                  )}
                  <ModeItemIcon 
                    className="w-6 h-6 relative z-10" 
                    style={{ color: isSelected ? modeItem.color : "var(--text-tertiary)" }}
                  />
                  <span 
                    className="text-xs font-semibold relative z-10"
                    style={{ color: isSelected ? modeItem.color : "var(--text-secondary)" }}
                  >
                    {modeItem.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Temperature Control */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Temperature</p>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={(e) => { e.stopPropagation(); handleTempChange(-1); }}
              disabled={isUpdating || targetTemp <= 50 || dominantMode === "off"}
              className="w-12 h-12 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] 
                       flex items-center justify-center transition-all duration-200 disabled:opacity-50
                       shadow-sm border border-[var(--border)] active:scale-95"
            >
              <Minus className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
            
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <span 
                  className="text-5xl font-light transition-colors"
                  style={{ color: dominantMode === "off" ? "var(--text-tertiary)" : tempColor }}
                >
                  {targetTemp}
                </span>
                <span className="text-2xl text-[var(--text-tertiary)]">°F</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {dominantMode === "off" ? "Thermostats Off" : "Target Temperature"}
              </p>
            </div>
            
            <button
              onClick={(e) => { e.stopPropagation(); handleTempChange(1); }}
              disabled={isUpdating || targetTemp >= 90 || dominantMode === "off"}
              className="w-12 h-12 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] 
                       flex items-center justify-center transition-all duration-200 disabled:opacity-50
                       shadow-sm border border-[var(--border)] active:scale-95"
            >
              <Plus className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
          </div>
          
          {/* Temperature Slider */}
          <div className="px-4 mt-4">
            <input
              type="range"
              min="50"
              max="90"
              value={targetTemp}
              onChange={handleSliderChange}
              onClick={(e) => e.stopPropagation()}
              disabled={isUpdating || dominantMode === "off"}
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
          {hasUnsavedChanges && dominantMode !== "off" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleApplyTemp(); }}
              disabled={isUpdating}
              className={`
                w-full mt-4 py-3 px-4 rounded-xl font-medium text-white
                transition-all duration-200 shadow-lg flex items-center justify-center gap-2
                ${isUpdating 
                  ? "bg-[var(--text-tertiary)] cursor-not-allowed" 
                  : "hover:opacity-90 active:scale-[0.98]"
                }
              `}
              style={!isUpdating ? { 
                backgroundColor: recommendedMode === "heat" ? "#EF4444" : recommendedMode === "cool" ? "#3B82F6" : "#10B981",
                boxShadow: `0 4px 14px ${recommendedMode === "heat" ? "#EF4444" : recommendedMode === "cool" ? "#3B82F6" : "#10B981"}40`
              } : undefined}
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating {mainThermostatCount} thermostats...
                </>
              ) : (
                <>
                  {recommendedMode === "heat" ? <Flame className="w-4 h-4" /> : 
                   recommendedMode === "cool" ? <Snowflake className="w-4 h-4" /> :
                   <Thermometer className="w-4 h-4" />}
                  Set Zone to {targetTemp}°
                </>
              )}
            </button>
          )}
        </div>
        
        {/* Fan Mode */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Fan</p>
          <div className="flex items-center justify-between p-3 bg-[var(--surface-hover)] rounded-xl">
            <div className="flex items-center gap-2">
              <Fan className="w-5 h-5 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">Fan Mode</span>
            </div>
            <div className="flex items-center gap-1 bg-[var(--surface)] rounded-lg p-1">
              {(Object.keys(fanModeConfig) as FanMode[]).map((fanModeKey) => (
                <button
                  key={fanModeKey}
                  onClick={(e) => { e.stopPropagation(); handleFanModeChange(fanModeKey); }}
                  disabled={isUpdating || dominantMode === "off"}
                  className={`
                    px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                    disabled:opacity-50
                    ${dominantFanMode === fanModeKey 
                      ? "bg-[var(--accent)] text-white shadow-sm" 
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }
                  `}
                >
                  {fanModeConfig[fanModeKey].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Quick Presets */}
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Quick Presets</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Energy Saver", temp: 68, icon: "🌿" },
              { label: "Comfort", temp: 72, icon: "😊" },
              { label: "Warm", temp: 76, icon: "☀️" },
            ].map((preset) => (
              <button
                key={preset.temp}
                onClick={(e) => { e.stopPropagation(); setTargetTemp(preset.temp); }}
                disabled={isUpdating || dominantMode === "off"}
                className={`
                  py-3 px-3 rounded-xl text-sm font-medium
                  transition-all duration-200 disabled:opacity-50
                  ${targetTemp === preset.temp
                    ? "bg-[var(--climate-color)]/20 text-[var(--climate-color)] border border-[var(--climate-color)]/30 shadow-sm"
                    : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  }
                `}
              >
                <span className="block text-lg mb-0.5">{preset.icon}</span>
                <span className="block font-bold">{preset.temp}°</span>
                <span className="block text-xs opacity-70">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Thermostat List Summary */}
        {displayThermostats.length > 0 ? (
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <p className="text-xs font-medium text-[var(--text-tertiary)] mb-3">
              Rooms in this zone ({displayThermostats.length}):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {displayThermostats.map((t) => {
                const setPoint = t.mode === "heat" ? t.heatSetPoint : t.coolSetPoint;
                const modeLabel = t.mode === "off" ? "Off" : t.mode === "heat" ? "Heat" : t.mode === "cool" ? "Cool" : "Auto";
                
                return (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); handleRoomClick(t); }}
                    className={`
                      px-3 py-2 rounded-lg text-sm text-left w-full
                      transition-all duration-200 hover:scale-[1.02] hover:shadow-md
                      cursor-pointer
                      ${t.mode === "off" 
                        ? "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]" 
                        : t.mode === "heat"
                          ? "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 hover:border-red-400"
                          : t.mode === "cool"
                            ? "bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 hover:border-blue-400"
                            : "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 hover:border-green-400"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {getThermostatDisplayName(t)}
                      </span>
                      <span 
                        className={`
                          text-xs px-1.5 py-0.5 rounded font-medium ml-2 flex-shrink-0
                          ${t.mode === "off" 
                            ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400" 
                            : t.mode === "heat"
                              ? "bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300"
                              : t.mode === "cool"
                                ? "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300"
                                : "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300"
                          }
                        `}
                      >
                        {modeLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-[var(--text-secondary)]">
                      <span>Now: <strong className="text-[var(--text-primary)]">{t.currentTemp}°</strong></span>
                      {t.mode !== "off" && (
                        <span>Set: <strong className="text-[var(--text-primary)]">{setPoint}°</strong></span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-tertiary)]">
              No main thermostats in this zone. Total thermostats: {thermostats.length}
            </p>
          </div>
        )}
      </div>
      
      {/* Collapsed Summary */}
      {!expanded && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${config.color}15`, color: config.color }}
            >
              <ModeIcon className="w-3.5 h-3.5" />
              {config.label}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--surface)] text-[var(--text-secondary)]">
              <Fan className="w-3.5 h-3.5" />
              Fan {dominantFanMode === "auto" ? "Auto" : "On"}
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-semibold" style={{ color: config.color }}>
              {avgSetPoint}°
            </span>
            <span className="text-sm text-[var(--text-tertiary)] ml-1">target</span>
          </div>
        </div>
      )}
      
      {/* Room Detail Modal */}
      <Modal
        open={isRoomModalOpen}
        onOpenChange={handleCloseRoomModal}
        title={selectedThermostat ? getThermostatDisplayName(selectedThermostat) : "Room Control"}
        description={
          isSelectedFloorHeatOnly 
            ? "Floor Heat Only" 
            : selectedFloorHeat 
              ? "Thermostat + Floor Heat" 
              : "Thermostat"
        }
        size="lg"
      >
        {selectedThermostat && (
          <div className="space-y-4">
            <ThermostatCard 
              thermostat={selectedThermostat} 
              isFloorHeatOnly={isSelectedFloorHeatOnly}
            />
            
            {selectedFloorHeat && !isSelectedFloorHeatOnly && (
              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">
                  Floor Heat
                </p>
                <ThermostatCard thermostat={selectedFloorHeat} compact isFloorHeatOnly />
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default ThermostatZoneControl;

