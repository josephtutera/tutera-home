"use client";

import { Card } from "@/components/ui/Card";
import { Lightbulb, Thermometer, Building2, Music, Tv, Palette, Star, Play } from "lucide-react";
import Link from "next/link";
import type { Room, Scene } from "@/lib/crestron/types";
import { useDeviceStore, recallScene } from "@/stores/deviceStore";
import { useMemo, useState, useCallback } from "react";

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
  mediaStatus: {
    isPoweredOn: boolean;
    currentSourceName: string | null;
    isVideo: boolean;
  } | null;
}

// Compact scene button for room tiles
function CompactSceneButton({ scene }: { scene: Scene }) {
  const [isActivating, setIsActivating] = useState(false);
  
  const handleActivate = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActivating(true);
    await recallScene(scene.id);
    setTimeout(() => setIsActivating(false), 1000);
  }, [scene.id]);
  
  return (
    <button
      onClick={handleActivate}
      disabled={isActivating}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
        bg-amber-500/10 text-amber-600 hover:bg-amber-500/20
        transition-colors disabled:opacity-50
        ${scene.isActive ? "ring-1 ring-amber-500" : ""}
      `}
      title={`Activate ${scene.name}`}
    >
      {isActivating ? (
        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Play className="w-3 h-3" />
      )}
      <span className="truncate max-w-[80px]">{scene.name}</span>
      {scene.isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
    </button>
  );
}

export function RoomStatusTile({ room, lightingStatus, climateStatus, mediaStatus }: RoomStatusTileProps) {
  const hasLights = lightingStatus !== null && lightingStatus.totalLights > 0;
  const hasClimate = climateStatus !== null;
  const hasMedia = mediaStatus !== null;
  
  // Get favorite scenes for this room
  const scenes = useDeviceStore((state) => state.scenes);
  const favoriteSceneIds = useDeviceStore((state) => state.favoriteSceneIds);
  
  const favoriteScenes = useMemo(() => {
    return scenes.filter(
      (scene) => scene.roomId === room.id && favoriteSceneIds.includes(scene.id)
    );
  }, [scenes, favoriteSceneIds, room.id]);
  
  const hasFavoriteScenes = favoriteScenes.length > 0;

  // Don't show rooms with no devices
  if (!hasLights && !hasClimate && !hasMedia) {
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

          {/* Media Status */}
          {hasMedia && (
            <div className={`flex items-center justify-between p-2 rounded-lg ${mediaStatus.isPoweredOn ? "bg-slate-500/10" : "bg-[var(--surface-hover)]"}`}>
              <div className="flex items-center gap-2">
                {mediaStatus.isVideo ? (
                  <Tv className={`w-4 h-4 ${mediaStatus.isPoweredOn ? "text-slate-500" : "text-[var(--text-tertiary)]"}`} />
                ) : (
                  <Music className={`w-4 h-4 ${mediaStatus.isPoweredOn ? "text-slate-500" : "text-[var(--text-tertiary)]"}`} />
                )}
                <span className="text-sm text-[var(--text-secondary)]">Media</span>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${mediaStatus.isPoweredOn ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>
                  {mediaStatus.isPoweredOn ? mediaStatus.currentSourceName || "Playing" : "Off"}
                </p>
              </div>
            </div>
          )}
          
          {/* Favorite Scenes */}
          {hasFavoriteScenes && (
            <div className="pt-2 border-t border-[var(--border-light)]">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-xs text-[var(--text-tertiary)]">Quick Scenes</span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {favoriteScenes.slice(0, 3).map((scene) => (
                  <CompactSceneButton key={scene.id} scene={scene} />
                ))}
                {favoriteScenes.length > 3 && (
                  <span className="text-xs text-[var(--text-tertiary)] self-center">
                    +{favoriteScenes.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

