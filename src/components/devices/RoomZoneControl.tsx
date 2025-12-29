"use client";

import {
  ChevronDown,
  ChevronRight,
  Building2,
  Lightbulb,
  Thermometer,
  Home,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RoomStatusTile } from "@/components/devices/RoomStatusTile";
import type { RoomZoneWithData } from "@/stores/deviceStore";

interface RoomZoneControlProps {
  zoneData: RoomZoneWithData;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function RoomZoneControl({ 
  zoneData, 
  expanded = false,
  onToggleExpand 
}: RoomZoneControlProps) {
  const { zone, rooms, totalRooms, totalLights, lightsOn, avgBrightness, avgCurrentTemp, activeThermostats } = zoneData;
  
  const lightsOff = totalLights - lightsOn;
  const ZoneIcon = zone.id === "whole-house" ? Home : Building2;
  
  return (
    <Card padding="lg" className="overflow-hidden">
      {/* Zone Header - Clickable to expand/collapse */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/10 flex items-center justify-center">
            <ZoneIcon className="w-7 h-7 text-[var(--accent)]" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              {zone.name}
            </h3>
            <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
              <span>{totalRooms} {totalRooms === 1 ? 'room' : 'rooms'}</span>
              {totalLights > 0 && (
                <>
                  <span>{totalLights} {totalLights === 1 ? 'light' : 'lights'}</span>
                  {lightsOn > 0 && (
                    <span className="text-[var(--light-color)] font-medium">{lightsOn} on</span>
                  )}
                </>
              )}
              {avgCurrentTemp > 0 && (
                <span className="text-[var(--climate-color)] font-medium">{avgCurrentTemp}°</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Stats indicators */}
          <div className="flex items-center gap-3">
            {lightsOn > 0 && (
              <div className="text-right">
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {avgBrightness}%
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Brightness</p>
              </div>
            )}
            {avgCurrentTemp > 0 && (
              <div className="text-right">
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {avgCurrentTemp}°
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Temp</p>
              </div>
            )}
          </div>
          
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
      {expanded && rooms.length > 0 && (
        <div className="mt-6 pt-6 border-t border-[var(--border-light)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((roomStatus) => (
              <RoomStatusTile
                key={roomStatus.room.id}
                room={roomStatus.room}
                lightingStatus={roomStatus.lightingStatus}
                climateStatus={roomStatus.climateStatus}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default RoomZoneControl;

