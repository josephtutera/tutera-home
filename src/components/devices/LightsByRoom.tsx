"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Lightbulb, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LightCard, LightGroupControl, levelToPercent, percentToLevel } from "./LightCard";
import type { Light, Room } from "@/lib/crestron/types";
import { setLightState } from "@/stores/deviceStore";

interface LightsByRoomProps {
  lights: Light[];
  rooms: Room[];
  maxLightsPerRoom?: number;
  showUnassigned?: boolean;
}

interface RoomGroup {
  roomId: string | undefined;
  roomName: string;
  lights: Light[];
}

// Swipeable Room Header Component
interface SwipeableRoomHeaderProps {
  group: RoomGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isWarning?: boolean;
}

function SwipeableRoomHeader({ group, isExpanded, onToggleExpand, isWarning = false }: SwipeableRoomHeaderProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);
  
  const onCount = group.lights.filter(l => l.isOn || l.level > 0).length;
  const totalLights = group.lights.length;
  
  // Calculate average brightness of all lights
  const avgPercent = useMemo(() => {
    if (totalLights === 0) return 0;
    const totalLevel = group.lights.reduce((sum, l) => sum + l.level, 0);
    return levelToPercent(Math.round(totalLevel / totalLights));
  }, [group.lights, totalLights]);
  
  const isOn = onCount > 0;

  const handleAllLights = useCallback(async (targetPercent: number) => {
    setIsUpdating(true);
    const targetLevel = percentToLevel(targetPercent);
    const isOn = targetPercent > 0;
    
    for (const light of group.lights) {
      await setLightState(light.id, targetLevel, isOn);
    }
    setIsUpdating(false);
  }, [group.lights]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isUpdating) return;
    // Don't start dragging if clicking on expand chevron area
    const target = e.target as HTMLElement;
    if (target.closest('[data-expand-button]')) return;
    
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

  return (
    <div
      ref={headerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`
        relative overflow-hidden w-full flex items-center justify-between p-3 rounded-xl
        cursor-ew-resize select-none touch-none
        transition-shadow duration-200
        ${isDragging ? "shadow-[var(--shadow-lg)] z-10" : ""}
        ${isUpdating ? "opacity-70 pointer-events-none" : ""}
      `}
    >
      {/* Dynamic background gradient fill - white to yellow */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl"
        animate={{
          background: isWarning 
            ? `linear-gradient(90deg, 
                rgba(245,158,11,0.1) 0%, 
                rgba(245,158,11,${0.1 + (bgFillPercent / 100) * 0.2}) ${bgFillPercent}%, 
                rgba(245,158,11,0.1) ${bgFillPercent + 2}%
              )`
            : `linear-gradient(90deg, 
                rgba(255,255,255,0.95) 0%, 
                rgba(252,211,77,${0.2 + (bgFillPercent / 100) * 0.4}) ${bgFillPercent}%, 
                rgba(245,158,11,${0.15 + (bgFillPercent / 100) * 0.4}) ${bgFillPercent}%, 
                rgba(255,255,255,0.95) ${bgFillPercent + 2}%
              )`,
        }}
        transition={{ duration: isDragging ? 0.05 : 0.3 }}
      />
      
      {/* Base background */}
      <div className={`absolute inset-0 rounded-xl -z-10 ${isWarning ? "bg-[var(--warning)]/10" : "bg-[var(--surface)]"}`} />
      
      {/* Content */}
      <div className="relative flex items-center gap-3">
        <motion.div 
          animate={{
            backgroundColor: bgFillPercent > 0 
              ? `rgba(252,211,77,${0.4 + (bgFillPercent / 100) * 0.4})` 
              : isWarning ? "rgba(245,158,11,0.2)" : "rgba(252,211,77,0.2)",
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center`}
        >
          <Lightbulb className={`w-4 h-4 transition-colors ${bgFillPercent > 0 ? "text-white" : isWarning ? "text-[var(--warning)]" : "text-[var(--light-color)]"}`} />
        </motion.div>
        <div className="text-left">
          <p className="font-medium text-[var(--text-primary)]">
            {group.roomName}
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
      
      <div className="relative flex items-center gap-3">
        {/* Percentage/count display */}
        <span className={`text-sm tabular-nums transition-colors ${isDragging ? "text-[var(--light-color-warm)] font-semibold" : "text-[var(--text-tertiary)]"}`}>
          {isDragging ? `${displayPercent}%` : `${totalLights} light${totalLights !== 1 ? "s" : ""}`}
        </span>
        
        {/* Expand button */}
        <button
          data-expand-button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="p-1 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
          )}
        </button>
      </div>
      
      {/* Mini brightness bar */}
      <div className="absolute bottom-0 left-3 right-3 h-1 bg-[var(--border)]/50 rounded-full overflow-hidden">
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
  );
}

export function LightsByRoom({ 
  lights, 
  rooms, 
  maxLightsPerRoom = 6,
  showUnassigned = true 
}: LightsByRoomProps) {
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  // Create a map of room IDs to room names for quick lookup
  const roomMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => map.set(room.id, room.name));
    return map;
  }, [rooms]);

  // Group lights by room
  const groupedLights = useMemo(() => {
    const groups = new Map<string | undefined, Light[]>();
    
    lights.forEach(light => {
      const roomId = light.roomId;
      if (!groups.has(roomId)) {
        groups.set(roomId, []);
      }
      groups.get(roomId)!.push(light);
    });

    // Convert to array and sort by room name
    const result: RoomGroup[] = [];
    
    groups.forEach((lightsInRoom, roomId) => {
      const roomName = roomId ? (roomMap.get(roomId) || `Unknown Room (${roomId})`) : "Unassigned";
      result.push({
        roomId,
        roomName,
        lights: lightsInRoom,
      });
    });

    // Sort: Unassigned last, then alphabetically by room name
    result.sort((a, b) => {
      if (!a.roomId) return 1;
      if (!b.roomId) return -1;
      return a.roomName.localeCompare(b.roomName);
    });

    return result;
  }, [lights, roomMap]);

  // Calculate statistics
  const stats = useMemo(() => {
    const assignedLights = lights.filter(l => l.roomId).length;
    const unassignedLights = lights.length - assignedLights;
    const lightsOn = lights.filter(l => l.isOn || l.level > 0).length;
    const roomsWithLights = new Set(lights.filter(l => l.roomId).map(l => l.roomId)).size;
    
    return {
      total: lights.length,
      assigned: assignedLights,
      unassigned: unassignedLights,
      lightsOn,
      roomsWithLights,
    };
  }, [lights]);

  const toggleRoom = (roomId: string) => {
    const newExpanded = new Set(expandedRooms);
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId);
    } else {
      newExpanded.add(roomId);
    }
    setExpandedRooms(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Statistics Summary */}
      <Card padding="md" className="bg-[var(--surface)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--light-color)]/20 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-[var(--light-color)]" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                {stats.lightsOn} of {stats.total} lights on
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {stats.roomsWithLights} rooms • {stats.assigned} assigned
                {stats.unassigned > 0 && (
                  <span className="text-[var(--warning)]"> • {stats.unassigned} unassigned</span>
                )}
              </p>
            </div>
          </div>
          <LightGroupControl lights={lights} standalone={false} />
        </div>
      </Card>

      {/* Unassigned Warning */}
      {stats.unassigned > 0 && showUnassigned && (
        <Card padding="sm" className="border-[var(--warning)]/30 bg-[var(--warning)]/5">
          <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
            <AlertCircle className="w-4 h-4" />
            <span>{stats.unassigned} lights are not assigned to any room</span>
          </div>
        </Card>
      )}

      {/* Room Groups */}
      <div className="space-y-3">
        {groupedLights.map((group) => {
          // Skip unassigned if showUnassigned is false
          if (!group.roomId && !showUnassigned) return null;
          
          const roomKey = group.roomId || "unassigned";
          const isExpanded = expandedRooms.has(roomKey);
          const visibleLights = isExpanded ? group.lights : group.lights.slice(0, maxLightsPerRoom);
          const hasMore = group.lights.length > maxLightsPerRoom && !isExpanded;

          return (
            <motion.div
              key={roomKey}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              {/* Swipeable Room Header */}
              <SwipeableRoomHeader
                group={group}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleRoom(roomKey)}
                isWarning={!group.roomId}
              />

              {/* Lights in Room */}
              <AnimatePresence>
                {(isExpanded || group.lights.length <= maxLightsPerRoom) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-4"
                  >
                    {visibleLights.map((light) => (
                      <LightCard 
                        key={light.id} 
                        light={light} 
                        compact 
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Show More Button */}
              {hasMore && (
                <button
                  onClick={() => toggleRoom(roomKey)}
                  className="w-full py-2 text-sm text-[var(--accent)] hover:underline"
                >
                  Show {group.lights.length - maxLightsPerRoom} more lights
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default LightsByRoom;

