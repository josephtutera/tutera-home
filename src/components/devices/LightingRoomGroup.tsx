"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { LightCard, LightGroupControl, levelToPercent, percentToLevel } from "@/components/devices/LightCard";
import type { LightingRoomGroup } from "@/stores/deviceStore";
import { setLightState } from "@/stores/deviceStore";
import { Building2, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

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
}

export function LightingRoomGroup({ group }: LightingRoomGroupComponentProps) {
  const { roomName, lights, lightsOn, totalLights, avgBrightness } = group;
  
  const lightsOff = totalLights - lightsOn;
  const isOn = lightsOn > 0;
  const [isUpdating, setIsUpdating] = useState(false);
  
  const buttonDisabled = isUpdating || lights.length === 0;

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

  return (
    <Card padding="lg" className="bg-gradient-to-br from-yellow-500/5 to-transparent relative" style={{ cursor: 'default' }}>
      {/* Room Header */}
      <div className="mb-4 relative" style={{ zIndex: 100, isolation: 'isolate', cursor: 'default' }}>
        <div className="flex items-center gap-3 mb-2 relative">
          <motion.button
            type="button"
            onClick={(e) => {
              console.log('Button onClick fired', { isOn, buttonDisabled });
              handleIconClick(e);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('Button onMouseDown fired');
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('Button onPointerDown fired');
              handleIconPointerDown(e);
            }}
            disabled={buttonDisabled}
            animate={{
              backgroundColor: isOn
                ? "rgba(252,211,77,1)"
                : "var(--surface-hover)",
              scale: isOn ? 1 : 0.95,
            }}
            transition={{ duration: 0.2 }}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
            title={isOn ? "Click to turn all lights off" : "Click to turn all lights on"}
            style={{ 
              pointerEvents: 'auto', 
              touchAction: 'manipulation',
              cursor: 'pointer',
            }}
          >
            <Lightbulb 
              className="w-5 h-5 transition-colors duration-200 pointer-events-none" 
              strokeWidth={2.5} 
              stroke={isOn ? "#ffffff" : "var(--text-tertiary)"} 
              fill="none"
              style={{ color: isOn ? "#ffffff" : "var(--text-tertiary)" }}
            />
          </motion.button>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {roomName}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {totalLights} {totalLights === 1 ? 'light' : 'lights'}
              {lightsOn > 0 && ` • ${lightsOn} on`}
              {lightsOff > 0 && ` • ${lightsOff} off`}
            </p>
          </div>
        </div>
        
        {/* Brightness indicator */}
        {lightsOn > 0 && (
          <div className="ml-[52px]">
            <p className="text-xl font-semibold text-[var(--text-primary)]">
              {avgBrightness}% avg brightness
            </p>
          </div>
        )}
      </div>

      {/* Room Group Control */}
      {lights.length > 0 && (
        <div className="mb-6">
          <LightGroupControl lights={lights} roomName={roomName} standalone={true} />
        </div>
      )}

      {/* Individual Lights */}
      {lights.length > 0 && (
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
      )}
    </Card>
  );
}

export default LightingRoomGroup;

