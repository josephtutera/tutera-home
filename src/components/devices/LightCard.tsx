"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Sun } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Light } from "@/lib/crestron/types";
import { setLightState } from "@/stores/deviceStore";

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

interface LightCardProps {
  light: Light;
  compact?: boolean;
  roomName?: string;
}

// Convert 0-65535 to 0-100
export function levelToPercent(level: number): number {
  return Math.round((level / 65535) * 100);
}

// Convert 0-100 to 0-65535
export function percentToLevel(percent: number): number {
  return Math.round((percent / 100) * 65535);
}

// Shared swipeable light control hook
export function useSwipeControl(options: {
  currentPercent: number;
  isOn: boolean;
  isDimmer: boolean;
  onLevelChange: (percent: number) => Promise<void>;
  onToggle: (turnOn: boolean) => Promise<void>;
  isUpdating: boolean;
}) {
  const { currentPercent, isOn, isDimmer, onLevelChange, onToggle, isUpdating } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate percentage from absolute position within the card
  const calculatePercentFromPosition = useCallback((clientX: number): number => {
    const card = cardRef.current;
    if (!card) return currentPercent;
    
    const rect = card.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percent = (relativeX / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(percent)));
  }, [currentPercent]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    // Don't start dragging if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    setIsDragging(true);
    setStartX(e.clientX);
    // For dimmers, immediately calculate percent from click position
    if (isDimmer) {
      const clickPercent = calculatePercentFromPosition(e.clientX);
      setDragPercent(clickPercent);
    } else {
      setDragPercent(currentPercent);
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isUpdating, currentPercent, isDimmer, calculatePercentFromPosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || isUpdating) return;
    
    if (isDimmer) {
      // For dimmers: calculate percent from absolute position for smooth sliding
      const newPercent = calculatePercentFromPosition(e.clientX);
      setDragPercent(newPercent);
    } else {
      // For switches: use relative movement for toggle detection
      const cardWidth = cardRef.current?.offsetWidth || 200;
      const deltaX = e.clientX - startX;
      const percentChange = (deltaX / cardWidth) * 100;
      const basePercent = dragPercent !== null ? dragPercent : currentPercent;
      const newPercent = Math.max(0, Math.min(100, basePercent + percentChange));
      setDragPercent(Math.round(newPercent));
    }
  }, [isDragging, isUpdating, isDimmer, startX, currentPercent, dragPercent, calculatePercentFromPosition]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (isDimmer) {
      // For dimmers: use the dragPercent value directly (updated during drag)
      // If dragPercent is null (shouldn't happen, but fallback), calculate from position
      let finalPercent = dragPercent;
      if (finalPercent === null) {
        finalPercent = calculatePercentFromPosition(e.clientX);
      }
      await onLevelChange(Math.max(0, Math.min(100, finalPercent)));
    } else {
      // For switches: swipe right = on, swipe left = off (threshold: 20% of card width)
      const cardWidth = cardRef.current?.offsetWidth || 200;
      const deltaX = e.clientX - startX;
      const threshold = 0.2 * cardWidth;
      if (deltaX > threshold && !isOn) {
        await onToggle(true);
      } else if (deltaX < -threshold && isOn) {
        await onToggle(false);
      }
    }
    
    setIsDragging(false);
    setDragPercent(null);
  }, [isDragging, isDimmer, dragPercent, startX, isOn, onLevelChange, onToggle, calculatePercentFromPosition]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isUpdating) return;
    
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (isDimmer) {
        onLevelChange(Math.min(100, currentPercent + 10));
      } else if (!isOn) {
        onToggle(true);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (isDimmer) {
        onLevelChange(Math.max(0, currentPercent - 10));
      } else if (isOn) {
        onToggle(false);
      }
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle(!isOn);
    }
  }, [isUpdating, isDimmer, currentPercent, isOn, onLevelChange, onToggle]);

  const displayPercent = isDragging && dragPercent !== null ? dragPercent : currentPercent;
  const bgFillPercent = isDragging && dragPercent !== null ? dragPercent : (isOn ? currentPercent : 0);

  return {
    cardRef,
    isDragging,
    displayPercent,
    bgFillPercent,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
}

export function LightCard({ light, compact = false, roomName }: LightCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const percent = levelToPercent(light.level);
  const isOn = light.isOn || light.level > 0;
  const isDimmer = light.subType === "dimmer";

  // Track last brightness when light is on
  useEffect(() => {
    if (isOn && percent > 0) {
      setLastBrightness(light.id, percent);
    }
  }, [light.id, isOn, percent]);

  const handleToggle = useCallback(async (turnOn: boolean) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (turnOn) {
        // Get last brightness or use 75% as default
        const lastBrightness = getLastBrightness(light.id);
        const targetPercent = lastBrightness !== null ? lastBrightness : 75;
        const targetLevel = percentToLevel(targetPercent);
        await setLightState(light.id, targetLevel, true);
      } else {
        // Save current brightness before turning off
        if (percent > 0) {
          setLastBrightness(light.id, percent);
        }
        await setLightState(light.id, 0, false);
      }
    } finally {
      setIsUpdating(false);
    }
  }, [light.id, isUpdating, percent]);

  // Handle icon click toggle
  const handleIconClick = useCallback(async (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUpdating) return;
    await handleToggle(!isOn);
  }, [handleToggle, isOn, isUpdating]);
  
  // Handle pointer events on icon to prevent swipe
  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleLevelChange = useCallback(async (newPercent: number) => {
    if (isUpdating) return;
    setIsUpdating(true);
    const newLevel = percentToLevel(Math.max(0, Math.min(100, newPercent)));
    await setLightState(light.id, newLevel, newPercent > 0);
    setIsUpdating(false);
  }, [light.id, isUpdating]);

  const {
    cardRef,
    isDragging,
    displayPercent,
    bgFillPercent,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  } = useSwipeControl({
    currentPercent: percent,
    isOn,
    isDimmer,
    onLevelChange: handleLevelChange,
    onToggle: handleToggle,
    isUpdating,
  });

  if (compact) {
    return (
      <div
        ref={cardRef}
        onPointerDown={isDimmer ? handlePointerDown : undefined}
        onPointerMove={isDimmer ? handlePointerMove : undefined}
        onPointerUp={isDimmer ? handlePointerUp : undefined}
        onPointerCancel={isDimmer ? handlePointerUp : undefined}
        onKeyDown={isDimmer ? handleKeyDown : undefined}
        role={isDimmer ? "slider" : "button"}
        aria-label={`${light.name} light control. ${isOn ? "On" : "Off"}. ${isDimmer ? "Slide to adjust brightness" : "Click to toggle"}`}
        aria-valuemin={isDimmer ? 0 : undefined}
        aria-valuemax={isDimmer ? 100 : undefined}
        aria-valuenow={isDimmer ? (isOn ? percent : 0) : undefined}
        aria-valuetext={isDimmer ? (isOn ? `${percent}% brightness` : "Off") : undefined}
        aria-pressed={!isDimmer ? isOn : undefined}
        tabIndex={0}
        className={`
          relative overflow-hidden rounded-[var(--radius)]
          transition-shadow duration-300
          border border-[var(--border-light)] shadow-[var(--shadow)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          ${isDimmer ? "cursor-ew-resize select-none touch-none" : ""}
          ${isDragging ? "shadow-[var(--shadow-lg)] z-10" : ""}
          ${isUpdating ? "opacity-70" : ""}
        `}
      >
        {/* Dynamic background gradient fill - white to yellow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: `linear-gradient(90deg, 
              rgba(255,255,255,0.95) 0%, 
              rgba(252,211,77,${0.3 + (bgFillPercent / 100) * 0.5}) ${bgFillPercent}%, 
              rgba(245,158,11,${0.2 + (bgFillPercent / 100) * 0.6}) ${bgFillPercent}%, 
              rgba(255,255,255,0.95) ${bgFillPercent + 2}%
            )`,
          }}
          transition={{ duration: isDragging ? 0.05 : 0.3 }}
        />
        
        {/* Content */}
        <div className="relative p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <motion.button
                type="button"
                onClick={handleIconClick}
                onPointerDown={handleIconPointerDown}
                disabled={isUpdating}
                animate={{
                  backgroundColor: isOn
                    ? `rgba(252,211,77,${0.5 + (bgFillPercent / 100) * 0.5})` 
                    : "rgba(252,211,77,0.2)",
                  scale: isOn ? 1 : 0.95,
                }}
                transition={{ duration: 0.2 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                title={isOn ? "Click to turn off" : "Click to turn on"}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
              >
                <Lightbulb className={`w-5 h-5 transition-colors duration-200 ${isOn ? "text-yellow-700" : "text-yellow-600"}`} strokeWidth={2.5} stroke={isOn ? "rgb(161, 98, 7)" : "rgb(161, 98, 7)"} fill="none" />
              </motion.button>
              <div className="min-w-0 flex-1">
                <p 
                  className="font-medium text-sm text-[var(--text-primary)] line-clamp-2 break-words leading-tight"
                  title={light.name}
                >
                  {light.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {roomName && <span className="text-[var(--text-tertiary)]">{roomName} · </span>}
                  {isDimmer ? (
                    isDragging ? (
                      <span className="text-[var(--light-color-warm)] font-semibold">{displayPercent}%</span>
                    ) : (
                      isOn ? `${percent}%` : "Off"
                    )
                  ) : (
                    isOn ? "On" : "Off"
                  )}
                </p>
              </div>
            </div>
            
            {/* Percentage indicator - only for dimmable lights */}
            {isDimmer && (
              <div className="flex items-center text-[var(--text-tertiary)] shrink-0">
                <span className={`text-sm font-medium tabular-nums transition-colors ${isDragging ? "text-[var(--light-color-warm)]" : ""}`}>
                  {displayPercent}%
                </span>
              </div>
            )}
          </div>
          
          {/* Mini brightness bar - only for dimmable lights */}
          {isDimmer && (
            <div 
              className="mt-2 h-1.5 bg-[var(--border)] rounded-full overflow-hidden cursor-ew-resize"
              onPointerDown={(e) => {
                // Allow slider bar to initiate drag
                e.stopPropagation();
                handlePointerDown(e);
              }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--light-color), var(--light-color-warm))",
                }}
                animate={{ width: `${displayPercent}%` }}
                transition={{ duration: isDragging ? 0.05 : 0.3 }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-size card
  return (
    <div
      ref={cardRef}
      onPointerDown={isDimmer ? handlePointerDown : undefined}
      onPointerMove={isDimmer ? handlePointerMove : undefined}
      onPointerUp={isDimmer ? handlePointerUp : undefined}
      onPointerCancel={isDimmer ? handlePointerUp : undefined}
      onKeyDown={isDimmer ? handleKeyDown : undefined}
      role={isDimmer ? "slider" : "button"}
      aria-label={`${light.name} light control. ${isOn ? "On" : "Off"}. ${isDimmer ? "Slide to adjust brightness" : "Click to toggle"}`}
      aria-valuemin={isDimmer ? 0 : undefined}
      aria-valuemax={isDimmer ? 100 : undefined}
      aria-valuenow={isDimmer ? (isOn ? percent : 0) : undefined}
      aria-valuetext={isDimmer ? (isOn ? `${percent}% brightness` : "Off") : undefined}
      aria-pressed={!isDimmer ? isOn : undefined}
      tabIndex={0}
      className={`
        relative overflow-hidden rounded-[var(--radius)]
        transition-shadow duration-300
        border border-[var(--border-light)] shadow-[var(--shadow)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
        ${isDimmer ? "cursor-ew-resize select-none touch-none" : ""}
        ${isDragging ? "shadow-[var(--shadow-lg)] z-10" : ""}
        ${isUpdating ? "opacity-70 pointer-events-none" : ""}
      `}
    >
      {/* Dynamic background gradient fill - white to yellow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: `linear-gradient(90deg, 
            rgba(255,255,255,0.95) 0%, 
            rgba(252,211,77,${0.3 + (bgFillPercent / 100) * 0.5}) ${bgFillPercent}%, 
            rgba(245,158,11,${0.2 + (bgFillPercent / 100) * 0.6}) ${bgFillPercent}%, 
            rgba(255,255,255,0.95) ${bgFillPercent + 2}%
          )`,
        }}
        transition={{ duration: isDragging ? 0.05 : 0.3 }}
      />
      
      {/* Content */}
      <div className="relative p-4">
        <CardHeader>
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={handleIconClick}
              onPointerDown={handleIconPointerDown}
              disabled={isUpdating}
              animate={{
                backgroundColor: isOn
                  ? `rgba(252,211,77,${0.5 + (bgFillPercent / 100) * 0.5})` 
                  : "rgba(252,211,77,0.2)",
                scale: isOn ? 1 : 0.95,
              }}
              className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
              title={isOn ? "Click to turn off" : "Click to turn on"}
              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
            >
              <Lightbulb className={`w-6 h-6 transition-colors duration-200 ${isOn ? "text-yellow-600" : "text-yellow-600"}`} strokeWidth={2.5} stroke="rgb(161, 98, 7)" fill="none" />
            </motion.button>
            <div>
              <CardTitle>{light.name}</CardTitle>
              <p className="text-sm text-[var(--text-secondary)]">
                {roomName && <span>{roomName} · </span>}
                {isDimmer ? "Dimmable" : "Switch"} · 
                {isDimmer ? (
                  <span className={`ml-1 ${isDragging ? "text-[var(--light-color-warm)] font-semibold" : ""}`}>
                    {displayPercent}%
                  </span>
                ) : (
                  <span className="ml-1">{isOn ? "On" : "Off"}</span>
                )}
              </p>
            </div>
          </div>
          
          {/* Percentage display - only for dimmable lights */}
          {isDimmer && (
            <span className={`text-lg font-semibold tabular-nums transition-colors ${isDragging ? "text-[var(--light-color-warm)]" : "text-[var(--text-primary)]"}`}>
              {displayPercent}%
            </span>
          )}
        </CardHeader>

        {/* Visual brightness indicator - only for dimmable lights */}
        {isDimmer && (
          <div className="mt-4 flex items-center gap-3 text-[var(--text-secondary)]">
            <Sun className="w-4 h-4 shrink-0" />
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
          </div>
        )}
        
        {/* Swipe instruction hint (shows when off and dimmable) */}
        {isDimmer && !isOn && !isDragging && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 0.6, y: 0 }}
            className="mt-3 text-xs text-center text-[var(--text-tertiary)]"
          >
            Slide right to turn on
          </motion.p>
        )}
      </div>
    </div>
  );
}

// Light group control (all lights in room)
interface LightGroupControlProps {
  lights: Light[];
  roomName?: string;
  standalone?: boolean;
}

export function LightGroupControl({ lights, roomName, standalone = true }: LightGroupControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const onCount = lights.filter(l => l.isOn || l.level > 0).length;
  const totalLights = lights.length;
  
  // Calculate average brightness of all lights
  const avgPercent = useMemo(() => {
    if (totalLights === 0) return 0;
    const totalLevel = lights.reduce((sum, l) => sum + l.level, 0);
    return levelToPercent(Math.round(totalLevel / totalLights));
  }, [lights, totalLights]);
  
  const isOn = onCount > 0;

  const handleAllLights = useCallback(async (targetPercent: number) => {
    setIsUpdating(true);
    const targetLevel = percentToLevel(targetPercent);
    const turnOn = targetPercent > 0;
    
    for (const light of lights) {
      await setLightState(light.id, targetLevel, turnOn);
    }
    setIsUpdating(false);
  }, [lights]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating || !standalone) return;
    setIsDragging(true);
    setStartX(e.clientX);
    setDragPercent(avgPercent);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isUpdating, avgPercent, standalone]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || isUpdating) return;
    
    const cardWidth = cardRef.current?.offsetWidth || 300;
    const deltaX = e.clientX - startX;
    const percentChange = (deltaX / cardWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, avgPercent + percentChange));
    setDragPercent(Math.round(newPercent));
  }, [isDragging, isUpdating, startX, avgPercent]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const cardWidth = cardRef.current?.offsetWidth || 300;
    const deltaX = e.clientX - startX;
    const percentChange = (deltaX / cardWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, avgPercent + percentChange));
    
    await handleAllLights(Math.round(newPercent));
    
    setIsDragging(false);
    setDragPercent(null);
  }, [isDragging, startX, avgPercent, handleAllLights]);

  const displayPercent = isDragging && dragPercent !== null ? dragPercent : avgPercent;
  const bgFillPercent = isDragging && dragPercent !== null ? dragPercent : (isOn ? avgPercent : 0);

  // Non-standalone: just render buttons
  if (!standalone) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAllLights(0)}
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
          onClick={() => handleAllLights(100)}
          disabled={onCount === totalLights || isUpdating}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${onCount === totalLights
              ? "bg-[var(--light-color)]/50 text-white cursor-not-allowed"
              : "bg-[var(--light-color)] text-white hover:bg-[var(--light-color)]/90"
            }
          `}
        >
          All On
        </button>
      </div>
    );
  }

  // Standalone: swipeable card
  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label={`${roomName ? `${roomName} lights` : "All lights"} control. ${onCount} of ${totalLights} on at ${avgPercent}% average brightness. Slide to adjust.`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={avgPercent}
      aria-valuetext={`${avgPercent}% brightness`}
      tabIndex={0}
      className={`
        relative overflow-hidden rounded-[var(--radius)] cursor-ew-resize
        transition-shadow duration-300 select-none touch-none
        border border-[var(--border-light)] shadow-[var(--shadow)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
        ${isDragging ? "shadow-[var(--shadow-lg)] z-10" : ""}
        ${isUpdating ? "opacity-70 pointer-events-none" : ""}
      `}
    >
      {/* Dynamic background gradient fill - white to yellow */}
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
      <div className="relative p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm text-[var(--text-primary)]">
              {roomName ? `${roomName} Lights` : "All Lights"}
            </p>
          </div>
          
          {/* Percentage display */}
          <span className={`text-sm font-medium tabular-nums transition-colors ${isDragging ? "text-[var(--light-color-warm)]" : "text-[var(--text-tertiary)]"}`}>
            {displayPercent}%
          </span>
        </div>
        
        {/* Mini brightness bar */}
        <div className="mt-2 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, var(--light-color), var(--light-color-warm))",
            }}
            animate={{ width: `${displayPercent}%` }}
            transition={{ duration: isDragging ? 0.05 : 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

export default LightCard;

