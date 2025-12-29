"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { LightCard, LightGroupControl, levelToPercent, percentToLevel } from "@/components/devices/LightCard";
import type { LightingRoomGroup } from "@/stores/deviceStore";
import { setLightState } from "@/stores/deviceStore";
import { Building2, Lightbulb, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

interface LightingRoomGroupComponentProps {
  group: LightingRoomGroup;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function LightingRoomGroup({ 
  group, 
  expanded = false, 
  onToggleExpand 
}: LightingRoomGroupComponentProps) {
  const { roomName, lights, lightsOn, totalLights, avgBrightness } = group;
  
  const lightsOff = totalLights - lightsOn;
  const isOn = lightsOn > 0;
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);
  
  const buttonDisabled = isUpdating || lights.length === 0;

  // Calculate average brightness of all lights
  const avgPercent = useMemo(() => {
    if (totalLights === 0) return 0;
    const totalLevel = lights.reduce((sum, l) => sum + l.level, 0);
    return levelToPercent(Math.round(totalLevel / totalLights));
  }, [lights, totalLights]);

  // Handle all lights brightness change (for swipe)
  const handleAllLights = useCallback(async (targetPercent: number) => {
    setIsUpdating(true);
    const targetLevel = percentToLevel(targetPercent);
    const isOn = targetPercent > 0;
    
    for (const light of lights) {
      await setLightState(light.id, targetLevel, isOn);
    }
    setIsUpdating(false);
  }, [lights]);

  // Handle room toggle - save/restore individual light brightness levels
  const handleRoomToggle = useCallback(async (e?: React.MouseEvent | React.PointerEvent) => {
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
      console.error('Error toggling room lights:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [isOn, lights, isUpdating]);

  // Handle swipe for brightness control
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    // Don't start dragging if clicking on expand chevron area or toggle button
    const target = e.target as HTMLElement;
    if (target.closest('[data-expand-button]') || target.closest('[data-toggle-button]')) return;
    
    setIsDragging(true);
    setStartX(e.clientX);
    setDragPercent(avgPercent);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isUpdating, avgPercent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || isUpdating) return;
    
    const headerWidth = headerRef.current?.offsetWidth || 300;
    const deltaX = e.clientX - startX;
    const percentChange = (deltaX / headerWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, avgPercent + percentChange));
    setDragPercent(Math.round(newPercent));
  }, [isDragging, isUpdating, startX, avgPercent]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const headerWidth = headerRef.current?.offsetWidth || 300;
    const deltaX = e.clientX - startX;
    const percentChange = (deltaX / headerWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, avgPercent + percentChange));
    
    await handleAllLights(Math.round(newPercent));
    
    setIsDragging(false);
    setDragPercent(null);
  }, [isDragging, startX, avgPercent, handleAllLights]);

  const displayPercent = isDragging && dragPercent !== null ? dragPercent : avgPercent;
  const bgFillPercent = isDragging && dragPercent !== null ? dragPercent : (isOn ? avgPercent : 0);

  // Handle icon click toggle (matching the pattern from LightCard)
  const handleIconClick = useCallback(async (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (buttonDisabled) return;
    console.log('Room icon clicked', { isOn, lightsCount: lights.length, buttonDisabled });
    await handleRoomToggle(e);
  }, [handleRoomToggle, buttonDisabled, isOn, lights]);
  
  // Handle pointer events on icon to prevent swipe
  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  // Slider control handlers
  const [sliderDragging, setSliderDragging] = useState(false);
  const [sliderDragPercent, setSliderDragPercent] = useState<number | null>(null);
  const [sliderStartX, setSliderStartX] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-expand-button]') || target.closest('[data-toggle-button]')) return;
    
    setSliderDragging(true);
    setSliderStartX(e.clientX);
    setSliderDragPercent(avgPercent);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isUpdating, avgPercent]);

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    if (!sliderDragging || isUpdating) return;
    
    const sliderWidth = sliderRef.current?.offsetWidth || 300;
    const deltaX = e.clientX - sliderStartX;
    const percentChange = (deltaX / sliderWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, avgPercent + percentChange));
    setSliderDragPercent(Math.round(newPercent));
  }, [sliderDragging, isUpdating, sliderStartX, avgPercent]);

  const handleSliderPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!sliderDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const sliderWidth = sliderRef.current?.offsetWidth || 300;
    const deltaX = e.clientX - sliderStartX;
    const percentChange = (deltaX / sliderWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, avgPercent + percentChange));
    
    await handleAllLights(Math.round(newPercent));
    
    setSliderDragging(false);
    setSliderDragPercent(null);
  }, [sliderDragging, sliderStartX, avgPercent, handleAllLights]);

  const sliderDisplayPercent = sliderDragging && sliderDragPercent !== null ? sliderDragPercent : avgPercent;
  const sliderBgFillPercent = sliderDragging && sliderDragPercent !== null ? sliderDragPercent : (isOn ? avgPercent : 0);

  return (
    <Card padding="lg" className="bg-gradient-to-br from-yellow-500/5 to-transparent relative overflow-hidden">
      {/* Single unified card content */}
      <div className="space-y-3">
        {/* Header Section */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <motion.button
              data-toggle-button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleIconClick(e);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleIconPointerDown(e);
              }}
              disabled={buttonDisabled}
              animate={{
                backgroundColor: bgFillPercent > 0 
                  ? `rgba(252,211,77,${0.4 + (bgFillPercent / 100) * 0.4})` 
                  : "rgba(252,211,77,0.2)",
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
              title={isOn ? "Click to turn all lights off" : "Click to turn all lights on"}
              style={{ 
                pointerEvents: 'auto', 
                touchAction: 'manipulation',
                cursor: 'pointer',
              }}
            >
              <Lightbulb 
                className={`w-4 h-4 transition-colors ${bgFillPercent > 0 ? "text-white" : "text-[var(--light-color)]"}`} 
              />
            </motion.button>
            <div className="text-left flex-1">
              <p className="font-medium text-[var(--text-primary)]">
                {roomName}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {`${lightsOn} of ${totalLights} on`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Light count */}
            <span className="text-sm text-[var(--text-tertiary)]">
              {totalLights} light{totalLights !== 1 ? "s" : ""}
            </span>
            
            {/* Expand button */}
            {onToggleExpand && (
              <button
                data-expand-button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="p-1 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Slider Control - Compact, inline with percentage */}
        {lights.length > 0 && (
          <div className="flex items-center gap-3">
            <div
              ref={sliderRef}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              role="slider"
              aria-label={`${roomName} lights control. ${lightsOn} of ${totalLights} on at ${avgPercent}% average brightness. Slide to adjust.`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={avgPercent}
              aria-valuetext={`${avgPercent}% brightness`}
              tabIndex={0}
              className={`
                flex-1 relative overflow-hidden rounded-lg cursor-ew-resize h-6
                transition-shadow duration-300 select-none touch-none
                bg-[var(--border-light)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
                ${sliderDragging ? "shadow-[var(--shadow-lg)] z-10" : ""}
                ${isUpdating ? "opacity-70 pointer-events-none" : ""}
              `}
            >
              {/* Brightness fill bar */}
              <motion.div
                className="absolute inset-0 h-full"
                style={{
                  background: "linear-gradient(90deg, var(--light-color), var(--light-color-warm))",
                }}
                animate={{ width: `${sliderDisplayPercent}%` }}
                transition={{ duration: sliderDragging ? 0.05 : 0.3 }}
              />
            </div>
            
            {/* Percentage display - inline right of slider */}
            <span className={`text-sm font-medium tabular-nums transition-colors min-w-[2.5rem] text-right ${sliderDragging ? "text-[var(--light-color-warm)]" : "text-[var(--text-tertiary)]"}`}>
              {sliderDisplayPercent}%
            </span>
          </div>
        )}
      </div>

      {/* Expanded Content - Only show when expanded */}
      <AnimatePresence>
        {expanded && lights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 pt-6 border-t border-[var(--border-light)]"
          >
            {/* Individual Lights */}
            <div>
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Individual Lights
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {lights.map((light) => (
                  <LightCard key={light.id} light={light} compact />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default LightingRoomGroup;

