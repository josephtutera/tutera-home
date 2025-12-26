"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Sun } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Light } from "@/lib/crestron/types";
import { setLightState } from "@/stores/deviceStore";

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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    setIsDragging(true);
    setStartX(e.clientX);
    setDragPercent(currentPercent);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isUpdating, currentPercent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || isUpdating) return;
    
    const cardWidth = cardRef.current?.offsetWidth || 200;
    const deltaX = e.clientX - startX;
    const percentChange = (deltaX / cardWidth) * 100;
    const newPercent = Math.max(0, Math.min(100, currentPercent + percentChange));
    setDragPercent(Math.round(newPercent));
  }, [isDragging, isUpdating, startX, currentPercent]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const cardWidth = cardRef.current?.offsetWidth || 200;
    const deltaX = e.clientX - startX;
    const percentChange = (deltaX / cardWidth) * 100;
    
    if (isDimmer) {
      const newPercent = Math.max(0, Math.min(100, currentPercent + percentChange));
      await onLevelChange(Math.round(newPercent));
    } else {
      // For switches: swipe right = on, swipe left = off (threshold: 20% of card width)
      const threshold = 0.2 * cardWidth;
      if (deltaX > threshold && !isOn) {
        await onToggle(true);
      } else if (deltaX < -threshold && isOn) {
        await onToggle(false);
      }
    }
    
    setIsDragging(false);
    setDragPercent(null);
  }, [isDragging, startX, isDimmer, currentPercent, isOn, onLevelChange, onToggle]);

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

  const handleToggle = useCallback(async (turnOn: boolean) => {
    if (isUpdating) return;
    setIsUpdating(true);
    if (turnOn) {
      await setLightState(light.id, 65535, true);
    } else {
      await setLightState(light.id, 0, false);
    }
    setIsUpdating(false);
  }, [light.id, isUpdating]);

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label={`${light.name} light control. ${isOn ? `On at ${percent}%` : "Off"}. ${isDimmer ? "Slide to adjust brightness" : "Slide to toggle"}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isOn ? percent : 0}
        aria-valuetext={isOn ? `${percent}% brightness` : "Off"}
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
              rgba(252,211,77,${0.3 + (bgFillPercent / 100) * 0.5}) ${bgFillPercent}%, 
              rgba(245,158,11,${0.2 + (bgFillPercent / 100) * 0.6}) ${bgFillPercent}%, 
              rgba(255,255,255,0.95) ${bgFillPercent + 2}%
            )`,
          }}
          transition={{ duration: isDragging ? 0.05 : 0.3 }}
        />
        
        {/* Content */}
        <div className="relative p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <motion.div
                animate={{
                  backgroundColor: bgFillPercent > 0 
                    ? `rgba(252,211,77,${0.5 + (bgFillPercent / 100) * 0.5})` 
                    : "var(--surface-hover)",
                  scale: bgFillPercent > 0 ? 1 : 0.95,
                }}
                transition={{ duration: 0.2 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              >
                <Lightbulb className={`w-5 h-5 transition-colors duration-200 ${bgFillPercent > 0 ? "text-white" : "text-[var(--text-tertiary)]"}`} />
              </motion.div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                  {light.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {roomName && <span className="text-[var(--text-tertiary)]">{roomName} · </span>}
                  {isDragging ? (
                    <span className="text-[var(--light-color-warm)] font-semibold">{displayPercent}%</span>
                  ) : (
                    isOn ? `${percent}%` : "Off"
                  )}
                </p>
              </div>
            </div>
            
            {/* Percentage indicator */}
            <div className="flex items-center text-[var(--text-tertiary)]">
              <span className={`text-sm font-medium tabular-nums transition-colors ${isDragging ? "text-[var(--light-color-warm)]" : ""}`}>
                {displayPercent}%
              </span>
            </div>
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

  // Full-size card
  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-label={`${light.name} light control. ${isOn ? `On at ${percent}%` : "Off"}. ${isDimmer ? "Slide to adjust brightness" : "Slide to toggle"}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isOn ? percent : 0}
      aria-valuetext={isOn ? `${percent}% brightness` : "Off"}
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
            <motion.div
              animate={{
                backgroundColor: bgFillPercent > 0 
                  ? `rgba(252,211,77,${0.5 + (bgFillPercent / 100) * 0.5})` 
                  : "var(--surface-hover)",
                scale: bgFillPercent > 0 ? 1 : 0.95,
              }}
              className="w-12 h-12 rounded-xl flex items-center justify-center"
            >
              <Lightbulb className={`w-6 h-6 transition-colors duration-200 ${bgFillPercent > 0 ? "text-white" : "text-[var(--text-tertiary)]"}`} />
            </motion.div>
            <div>
              <CardTitle>{light.name}</CardTitle>
              <p className="text-sm text-[var(--text-secondary)]">
                {roomName && <span>{roomName} · </span>}
                {isDimmer ? "Dimmable" : "Switch"} · 
                <span className={`ml-1 ${isDragging ? "text-[var(--light-color-warm)] font-semibold" : ""}`}>
                  {displayPercent}%
                </span>
              </p>
            </div>
          </div>
          
          {/* Percentage display */}
          <span className={`text-lg font-semibold tabular-nums transition-colors ${isDragging ? "text-[var(--light-color-warm)]" : "text-[var(--text-primary)]"}`}>
            {displayPercent}%
          </span>
        </CardHeader>

        {/* Visual brightness indicator */}
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
        
        {/* Swipe instruction hint (shows when off) */}
        {!isOn && !isDragging && (
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
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                backgroundColor: bgFillPercent > 0 
                  ? `rgba(252,211,77,${0.4 + (bgFillPercent / 100) * 0.4})` 
                  : "rgba(252,211,77,0.2)",
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
            >
              <Lightbulb className={`w-5 h-5 transition-colors ${bgFillPercent > 0 ? "text-white" : "text-[var(--light-color)]"}`} />
            </motion.div>
            <div>
              <p className="font-medium text-sm text-[var(--text-primary)]">
                {roomName ? `${roomName} Lights` : "All Lights"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {isDragging ? (
                  <span className="text-[var(--light-color-warm)] font-semibold">{displayPercent}%</span>
                ) : (
                  `${onCount} of ${totalLights} on`
                )}
              </p>
            </div>
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

