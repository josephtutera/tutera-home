"use client";

import { Card } from "@/components/ui/Card";
import { Lightbulb, Thermometer, Building2 } from "lucide-react";
import Link from "next/link";
import type { Room } from "@/lib/crestron/types";

interface RoomStatusTileProps {
  room: Room;
  lightingStatus: {
    lightsOn: number;
    totalLights: number;
    avgBrightness: number;
  } | null;
  climateStatus: {
    currentTemp: number;
    setPoint: number;
    mode: string;
  } | null;
}

export function RoomStatusTile({ room, lightingStatus, climateStatus }: RoomStatusTileProps) {
  const hasLights = lightingStatus !== null && lightingStatus.totalLights > 0;
  const hasClimate = climateStatus !== null;

  // Don't show rooms with no devices
  if (!hasLights && !hasClimate) {
    return null;
  }

  return (
    <Link href={`/rooms/${room.id}`}>
      <Card padding="md" className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex-1">
            {room.name}
          </h3>
        </div>

        <div className="space-y-2">
          {/* Lighting Status */}
          {hasLights && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--light-color)]/10">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[var(--light-color)]" />
                <span className="text-sm text-[var(--text-secondary)]">Lights</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {lightingStatus.lightsOn}/{lightingStatus.totalLights} on
                </p>
                {lightingStatus.lightsOn > 0 && (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {lightingStatus.avgBrightness}% brightness
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Climate Status */}
          {hasClimate && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--climate-color)]/10">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-[var(--climate-color)]" />
                <span className="text-sm text-[var(--text-secondary)]">Climate</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {climateStatus.currentTemp}°
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Set: {climateStatus.setPoint}° • {climateStatus.mode.charAt(0).toUpperCase() + climateStatus.mode.slice(1)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

