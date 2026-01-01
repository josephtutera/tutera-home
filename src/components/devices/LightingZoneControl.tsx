"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LightCard, levelToPercent, percentToLevel } from "@/components/devices/LightCard";
import { LightingRoomGroup } from "@/components/devices/LightingRoomGroup";
import { setLightState } from "@/stores/deviceStore";
import type { LightingZoneWithData } from "@/stores/deviceStore";
import { useSettingsStore } from "@/stores/settingsStore";

// Helper to get/set last brightness level from localStorage
const LAST_BRIGHTNESS_KEY = "tutera-last-brightness";
function getLastBrightness(lightId: string): number | null {
  try {
    const stored = localStorage.getItem(LAST_BRIGHTNESS_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data[lightId] || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function setLastBrightness(lightId: string, brightness: number): void {
  try {
    const stored = localStorage.getItem(LAST_BRIGHTNESS_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[lightId] = brightness;
    localStorage.setItem(LAST_BRIGHTNESS_KEY, JSON.stringify(data));
  } catch {
    // Ignore errors
  }
}

interface LightingZoneControlProps {
  zoneData: LightingZoneWithData;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function LightingZoneControl({ 
  zoneData, 
  expanded = false,
  onToggleExpand 
}: LightingZoneControlProps) {
  const { zone, lights, rooms, roomGroups, totalLights, lightsOn, avgBrightness } = zoneData;
  
  // Get settings
  const { zoneControlStyle, sliderActivationDelay } = useSettingsStore();
  
  // Track which rooms are expanded within this zone
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  
  // Slider state for collapsed view
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // Press-and-hold state for slider activation (touch safety)
  const [isSliderActivated, setIsSliderActivated] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  
  // Clear hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);
  
  const lightsOff = totalLights - lightsOn;
  const onPercentage = totalLights > 0 ? Math.round((lightsOn / totalLights) * 100) : 0;
  
  // Calculate average brightness for slider
  const avgPercent = useMemo(() => {
    if (totalLights === 0) return 0;
    const totalLevel = lights.reduce((sum, l) => sum + l.level, 0);
    return levelToPercent(Math.round(totalLevel / totalLights));
  }, [lights, totalLights]);
  
  const isOn = lightsOn > 0;
  
  // Use roomGroups if available, otherwise fall back to grouping lights by roomId
  const displayRoomGroups = roomGroups && roomGroups.length > 0 
    ? roomGroups 
    : (() => {
        // Fallback: group lights by roomId
        const grouped = new Map<string, typeof lights>();
        lights.forEach(light => {
          if (light.roomId) {
            const existing = grouped.get(light.roomId) || [];
            existing.push(light);
            grouped.set(light.roomId, existing);
          }
        });
        return Array.from(grouped.entries()).map(([roomId, roomLights]) => ({
          roomId,
          roomName: rooms.find(r => r.id === roomId)?.name || roomId,
          lights: roomLights,
          lightsOn: roomLights.filter(l => l.isOn || l.level > 0).length,
          totalLights: roomLights.length,
          avgBrightness: roomLights.length > 0
            ? Math.round((roomLights.reduce((sum, l) => sum + Math.round((l.level / 65535) * 100), 0) / roomLights.length))
            : 0,
          equipment: [],  // Fallback doesn't have equipment data
        }));
      })();

  const handleRoomToggle = (roomId: string) => {
    const newExpanded = new Set(expandedRooms);
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId);
    } else {
      newExpanded.add(roomId);
    }
    setExpandedRooms(newExpanded);
  };

  // Handle all lights brightness change (for slider)
  const handleAllLights = useCallback(async (targetPercent: number) => {
    setIsUpdating(true);
    const targetLevel = percentToLevel(targetPercent);
    const turnOn = targetPercent > 0;
    
    for (const light of lights) {
      await setLightState(light.id, targetLevel, turnOn);
    }
    setIsUpdating(false);
  }, [lights]);

  // Calculate percentage from absolute position within the slider
  const calculatePercentFromPosition = useCallback((clientX: number): number => {
    const slider = sliderRef.current;
    if (!slider) return avgPercent;
    
    const rect = slider.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percent = (relativeX / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(percent)));
  }, [avgPercent]);

  // Slider pointer event handlers with press-and-hold activation for touch safety
  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    e.stopPropagation(); // Prevent card expansion when clicking slider
    
    pointerIdRef.current = e.pointerId;
    setIsHolding(true);
    setStartX(e.clientX);
    
    // Start hold timer - slider activates after delay
    holdTimerRef.current = setTimeout(() => {
      setIsSliderActivated(true);
      setIsDragging(true);
      // Calculate initial percent from current position
      const clickPercent = calculatePercentFromPosition(e.clientX);
      setDragPercent(clickPercent);
    }, sliderActivationDelay);
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isUpdating, calculatePercentFromPosition, sliderActivationDelay]);

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    
    // If still in hold phase, check if user moved too much (cancel activation)
    if (isHolding && !isSliderActivated) {
      const moveDistance = Math.abs(e.clientX - startX);
      if (moveDistance > 10) {
        // User is scrolling, not trying to use slider - cancel
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        setIsHolding(false);
        if (pointerIdRef.current !== null) {
          try {
            (e.target as HTMLElement).releasePointerCapture(pointerIdRef.current);
          } catch {
            // Ignore if already released
          }
        }
        return;
      }
    }
    
    // Only respond if slider is activated
    if (!isDragging || !isSliderActivated) return;
    
    // Calculate percent from absolute position for smooth sliding
    const newPercent = calculatePercentFromPosition(e.clientX);
    setDragPercent(newPercent);
  }, [isDragging, isUpdating, isHolding, isSliderActivated, startX, calculatePercentFromPosition]);

  const handleSliderPointerUp = useCallback(async (e: React.PointerEvent) => {
    // Clear hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if already released
    }
    
    // Only apply changes if slider was activated
    if (isDragging && isSliderActivated && dragPercent !== null) {
      await handleAllLights(Math.max(0, Math.min(100, dragPercent)));
    }
    
    setIsHolding(false);
    setIsDragging(false);
    setIsSliderActivated(false);
    setDragPercent(null);
    pointerIdRef.current = null;
  }, [isDragging, isSliderActivated, dragPercent, handleAllLights]);

  const displayPercent = isDragging && dragPercent !== null ? dragPercent : avgPercent;
  const bgFillPercent = isDragging && dragPercent !== null ? dragPercent : (isOn ? avgPercent : 0);

  // Handle zone toggle - save/restore individual light brightness levels
  const handleZoneToggle = useCallback(async (e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isUpdating || lights.length === 0) return;
    
    setIsUpdating(true);
    
    try {
      if (isOn) {
        // Turning off: save each light's current brightness
        const promises = lights.map(async (light) => {
          const percent = levelToPercent(light.level);
          if (percent > 0) {
            setLastBrightness(light.id, percent);
          }
          return setLightState(light.id, 0, false);
        });
        await Promise.all(promises);
      } else {
        // Turning on: restore each light to its last brightness (or 75% default)
        const promises = lights.map(async (light) => {
          const lastBrightness = getLastBrightness(light.id);
          const targetPercent = lastBrightness !== null ? lastBrightness : 75;
          const targetLevel = percentToLevel(targetPercent);
          return setLightState(light.id, targetLevel, true);
        });
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error toggling zone lights:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [isOn, lights, isUpdating]);

  // Handle icon click toggle
  const handleIconClick = useCallback(async (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUpdating || lights.length === 0) return;
    await handleZoneToggle(e);
  }, [handleZoneToggle, isUpdating, lights.length]);

  // Handle pointer events on icon to prevent expand/collapse
  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Card padding="lg" className="overflow-hidden">
      {/* Zone Header - Clickable to expand/collapse */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <motion.button
            type="button"
            onClick={handleIconClick}
            onPointerDown={handleIconPointerDown}
            disabled={isUpdating || lights.length === 0}
            animate={{
              backgroundColor: isOn
                ? `rgba(252,211,77,${0.5 + (bgFillPercent / 100) * 0.5})` 
                : "rgba(252,211,77,0.2)",
              scale: isOn ? 1 : 0.95,
            }}
            transition={{ duration: 0.2 }}
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
            title={isOn ? "Click to turn off" : "Click to turn on"}
            style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
          >
            <Lightbulb className={`w-7 h-7 transition-colors duration-200 ${isOn ? "text-yellow-700" : "text-yellow-600"}`} strokeWidth={2.5} stroke={isOn ? "rgb(161, 98, 7)" : "rgb(161, 98, 7)"} fill="none" />
          </motion.button>
          
          <button
            onClick={onToggleExpand}
            className="flex-1 text-left"
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              {zone.name}
            </h3>
            <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
              <span>{totalLights} {totalLights === 1 ? 'light' : 'lights'}</span>
              {lightsOn > 0 && (
                <span className="text-yellow-500 font-medium">{lightsOn} on</span>
              )}
              {lightsOff > 0 && (
                <span className="text-[var(--text-tertiary)]">{lightsOff} off</span>
              )}
              {rooms.length > 0 && (
                <div className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
                </div>
              )}
            </div>
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Brightness indicator */}
          {lightsOn > 0 && (
            <div className="text-right">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {avgBrightness}%
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">Avg Brightness</p>
            </div>
          )}
          
          {/* Expand/Collapse Icon */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
              ) : (
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collapsed View - Brightness Control */}
      {!expanded && lights.length > 0 && (
        <div className={`mt-4 ${isUpdating ? "opacity-70 pointer-events-none" : ""}`}>
          {zoneControlStyle === "buttons" ? (
            /* Preset Buttons Mode (safer for touch devices) */
            <div className="flex items-center gap-1.5">
              {[
                { label: "Off", value: 0 },
                { label: "25%", value: 25 },
                { label: "50%", value: 50 },
                { label: "75%", value: 75 },
                { label: "100%", value: 100 },
              ].map((preset) => {
                const isActive = !isOn && preset.value === 0 || 
                  (isOn && avgPercent >= preset.value - 12 && avgPercent <= preset.value + 12);
                return (
                  <button
                    key={preset.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAllLights(preset.value);
                    }}
                    disabled={isUpdating}
                    className={`
                      flex-1 py-2 px-1 rounded-lg text-xs font-medium
                      transition-all duration-200 
                      ${isActive
                        ? preset.value === 0 
                          ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          : "bg-yellow-400 text-yellow-900 shadow-sm"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-light)]"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Slider Mode (with press-and-hold activation) */
            <div 
              ref={sliderRef}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              role="slider"
              aria-label={`${zone.name} lights control. ${lightsOn} of ${totalLights} on at ${avgPercent}% average brightness. Hold to adjust.`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={avgPercent}
              aria-valuetext={`${avgPercent}% brightness`}
              tabIndex={0}
              className={`
                relative overflow-hidden rounded-[var(--radius)] cursor-ew-resize
                transition-all duration-300 select-none touch-none
                border-2 bg-[var(--surface)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
                ${isSliderActivated 
                  ? "border-yellow-400 shadow-lg shadow-yellow-400/30" 
                  : isHolding 
                    ? "border-yellow-300 animate-pulse" 
                    : "border-[var(--border-light)]"
                }
                ${isUpdating ? "opacity-70 pointer-events-none" : ""}
              `}
            >
              {/* Dynamic background gradient fill */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{
                  background: `linear-gradient(90deg, 
                    rgba(255,255,255,0.95) 0%, 
                    rgba(252,211,77,${0.2 + (bgFillPercent / 100) * 0.4}) ${bgFillPercent}%, 
                    rgba(245,158,11,${0.15 + (bgFillPercent / 100) * 0.4}) ${bgFillPercent}%, 
                    rgba(255,255,255,0.95) ${bgFillPercent + 2}%
                  )`,
                }}
                transition={{ duration: isDragging ? 0.05 : 0.3 }}
              />
              
              {/* Content */}
              <div className="relative p-2.5">
                <div className="flex items-center gap-3">
                  {/* Hold indicator */}
                  <span className={`text-[10px] font-medium transition-opacity ${isSliderActivated ? "opacity-0" : "opacity-60"} text-[var(--text-tertiary)]`}>
                    {isHolding && !isSliderActivated ? "Hold..." : "Hold to adjust"}
                  </span>
                  
                  {/* Slider bar */}
                  <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg, var(--light-color), var(--light-color-warm))",
                      }}
                      animate={{ width: `${displayPercent}%` }}
                      transition={{ duration: isDragging ? 0.05 : 0.3 }}
                    />
                  </div>
                  
                  {/* Percentage display */}
                  <span className={`text-sm font-semibold tabular-nums transition-colors shrink-0 ${isSliderActivated ? "text-yellow-600" : "text-[var(--text-secondary)]"}`}>
                    {displayPercent}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {expanded && lights.length > 0 && (
        <div className="mt-4 border-t border-[var(--border-light)] pt-2">
          {/* Zone Group Control - Compact Slider */}
          <div className="mb-6">
            <div 
              ref={sliderRef}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              role="slider"
              aria-label={`${zone.name} lights control. ${lightsOn} of ${totalLights} on at ${avgPercent}% average brightness. Slide to adjust.`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={avgPercent}
              aria-valuetext={`${avgPercent}% brightness`}
              tabIndex={0}
              className={`
                relative overflow-hidden rounded-[var(--radius)] cursor-ew-resize
                transition-shadow duration-300 select-none touch-none
                border border-[var(--border-light)] bg-[var(--surface)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
                ${isDragging ? "shadow-[var(--shadow-lg)] z-10" : ""}
                ${isUpdating ? "opacity-70 pointer-events-none" : ""}
              `}
            >
              {/* Dynamic background gradient fill */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{
                  background: `linear-gradient(90deg, 
                    rgba(255,255,255,0.95) 0%, 
                    rgba(252,211,77,${0.2 + (bgFillPercent / 100) * 0.4}) ${bgFillPercent}%, 
                    rgba(245,158,11,${0.15 + (bgFillPercent / 100) * 0.4}) ${bgFillPercent}%, 
                    rgba(255,255,255,0.95) ${bgFillPercent + 2}%
                  )`,
                }}
                transition={{ duration: isDragging ? 0.05 : 0.3 }}
              />
              
              {/* Content */}
              <div className="relative p-2">
                <div className="flex items-center gap-3">
                  {/* Slider bar */}
                  <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg, var(--light-color), var(--light-color-warm))",
                      }}
                      animate={{ width: `${displayPercent}%` }}
                      transition={{ duration: isDragging ? 0.05 : 0.3 }}
                    />
                  </div>
                  
                  {/* Percentage display on the right */}
                  <span className={`text-sm font-medium tabular-nums transition-colors shrink-0 ${isDragging ? "text-[var(--light-color-warm)]" : "text-[var(--text-tertiary)]"}`}>
                    {displayPercent}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Room Groups */}
          {displayRoomGroups.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Lights by Room in {zone.name}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayRoomGroups.map((roomGroup) => (
                  <LightingRoomGroup 
                    key={roomGroup.roomId} 
                    group={roomGroup}
                    expanded={expandedRooms.has(roomGroup.roomId || '')}
                    onToggleExpand={() => handleRoomToggle(roomGroup.roomId || '')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default LightingZoneControl;

