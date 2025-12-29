"use client";

import { useState, useMemo } from "react";
import {
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LightCard, LightGroupControl } from "@/components/devices/LightCard";
import { LightingRoomGroup } from "@/components/devices/LightingRoomGroup";
import type { LightingZoneWithData } from "@/stores/deviceStore";

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
  
  // Track which rooms are expanded within this zone
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  
  const lightsOff = totalLights - lightsOn;
  const onPercentage = totalLights > 0 ? Math.round((lightsOn / totalLights) * 100) : 0;
  
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

  return (
    <Card padding="lg" className="overflow-hidden">
      {/* Zone Header - Clickable to expand/collapse */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
            <Lightbulb className="w-7 h-7 text-yellow-500" />
          </div>
          
          <div className="flex-1">
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
          </div>
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
            <div className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
              {expanded ? (
                <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
              ) : (
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
              )}
            </div>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && lights.length > 0 && (
        <div className="mt-6 pt-6 border-t border-[var(--border-light)]">
          {/* Zone Group Control */}
          <div className="mb-6">
            <LightGroupControl lights={lights} roomName={zone.name} standalone={true} />
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

