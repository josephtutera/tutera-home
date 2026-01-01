"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Music,
  Tv,
  Power,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Ban,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Circle,
  Home,
  Menu,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import type { MediaRoom } from "@/lib/crestron/types";
import { hasVolumeControl, hasMuteControl } from "@/lib/crestron/types";
import { 
  setMediaRoomPower, 
  setMediaRoomVolume, 
  setMediaRoomMute, 
  selectMediaRoomSource,
  mediaRoomPlay,
  mediaRoomPause,
  mediaRoomNext,
  mediaRoomPrevious,
} from "@/stores/deviceStore";

interface MediaRoomCardProps {
  mediaRoom: MediaRoom;
  compact?: boolean;
  roomName?: string;
}

// Helper to detect if a source is video-based from its name
function isVideoSource(sourceName: string | undefined): boolean {
  if (!sourceName) return false;
  
  const videoKeywords = [
    'tv', 'apple tv', 'roku', 'firestick', 'fire stick', 'chromecast',
    'hdmi', 'video', 'nvr', 'camera', 'dvr', 'cable', 'satellite',
    'dish', 'directv', 'xfinity', 'projector', 'bluray', 'blu-ray',
    'dvd', 'gaming', 'xbox', 'playstation', 'nintendo', 'switch',
    'screen', 'display', 'monitor'
  ];
  
  const lowerName = sourceName.toLowerCase();
  return videoKeywords.some(keyword => lowerName.includes(keyword));
}

// Helper to detect if source is specifically an Apple TV
function isAppleTVSource(sourceName: string | undefined): boolean {
  if (!sourceName) return false;
  const lowerName = sourceName.toLowerCase();
  return lowerName.includes('apple tv') || lowerName.includes('appletv') || lowerName.includes('atv');
}

// D-pad button component
function DPadButton({
  onClick,
  disabled,
  children,
  className = "",
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        w-10 h-10 flex items-center justify-center rounded-xl
        bg-[var(--surface)] hover:bg-[var(--surface-hover)]
        text-[var(--text-secondary)] hover:text-[var(--text-primary)]
        transition-all duration-150 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export function MediaRoomCard({ mediaRoom, compact = false, roomName }: MediaRoomCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [localVolume, setLocalVolume] = useState<number | null>(null); // Local state for slider during drag
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [lastRemoteCommand, setLastRemoteCommand] = useState<string | null>(null);
  const [showDPad, setShowDPad] = useState(false); // Toggle D-pad visibility
  
  // Use a ref to always access the latest data in callbacks for other operations
  const mediaRoomRef = useRef(mediaRoom);
  useEffect(() => {
    mediaRoomRef.current = mediaRoom;
  }, [mediaRoom]);
  
  // Check if controls are available per API
  const canControlVolume = hasVolumeControl(mediaRoom);
  const canMute = hasMuteControl(mediaRoom);
  const hasSources = mediaRoom.availableProviders.length > 0;
  
  const displayName = roomName || mediaRoom.name;
  
  // Determine if current source is video and specifically Apple TV
  const isVideo = isVideoSource(mediaRoom.currentSourceName);
  const isAppleTV = isAppleTVSource(mediaRoom.currentSourceName);
  const MediaIcon = isVideo ? Tv : Music;
  
  const handlePowerToggle = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      // Use the current mediaRoom prop directly to ensure we have the latest state
      // This prevents using stale state that might cause incorrect toggles
      const currentState = mediaRoom.isPoweredOn;
      const newPowerState = currentState ? "off" : "on";
      await setMediaRoomPower(mediaRoom.id, newPowerState);
    } finally {
      setIsUpdating(false);
    }
  }, [mediaRoom.id, mediaRoom.isPoweredOn, isUpdating]);
  
  const handleVolumeChange = useCallback((value: number[]) => {
    // Update local state during drag for responsive UI
    setLocalVolume(value[0]);
  }, []);
  
  const handleVolumeCommit = useCallback(async (value: number[]) => {
    setIsUpdating(true);
    await setMediaRoomVolume(mediaRoomRef.current.id, value[0]);
    setLocalVolume(null); // Clear local state, use actual value from store
    setIsUpdating(false);
  }, []);
  
  const handleMuteToggle = useCallback(async () => {
    setIsUpdating(true);
    await setMediaRoomMute(mediaRoomRef.current.id, !mediaRoomRef.current.isMuted);
    setIsUpdating(false);
  }, []);
  
  const handleSourceSelect = useCallback(async (sourceIndex: number) => {
    setIsUpdating(true);
    setShowSourcePicker(false);
    await selectMediaRoomSource(mediaRoomRef.current.id, sourceIndex);
    setIsUpdating(false);
  }, []);

  // Transport control handlers
  const handlePlay = useCallback(async () => {
    setIsUpdating(true);
    await mediaRoomPlay(mediaRoomRef.current.id);
    setIsUpdating(false);
  }, []);

  const handlePause = useCallback(async () => {
    setIsUpdating(true);
    await mediaRoomPause(mediaRoomRef.current.id);
    setIsUpdating(false);
  }, []);

  const handlePrevious = useCallback(async () => {
    setIsUpdating(true);
    await mediaRoomPrevious(mediaRoomRef.current.id);
    setIsUpdating(false);
  }, []);

  const handleNext = useCallback(async () => {
    setIsUpdating(true);
    await mediaRoomNext(mediaRoomRef.current.id);
    setIsUpdating(false);
  }, []);

  // Apple TV remote command handler
  const sendAppleTVCommand = useCallback(async (command: string) => {
    setIsRemoteLoading(true);
    setLastRemoteCommand(command);
    
    try {
      // First, try to get the list of Apple TVs
      const devicesResponse = await fetch("/api/appletv/devices");
      if (!devicesResponse.ok) {
        console.warn("Apple TV service not available");
        return;
      }
      
      const devices = await devicesResponse.json();
      if (!Array.isArray(devices) || devices.length === 0) {
        console.warn("No Apple TVs found");
        return;
      }
      
      // Filter to only actual Apple TV devices (not Samsung TVs, Sonos, etc.)
      const appleTVDevices = devices.filter((d: { name: string }) => {
        const name = d.name.toLowerCase();
        return name.includes("apple") || name.includes("atv");
      });
      
      if (appleTVDevices.length === 0) {
        console.warn("No Apple TV devices found (only other AirPlay devices)");
        return;
      }
      
      // Try to match Apple TV to the current room/source name
      const currentSource = mediaRoom.currentSourceName?.toLowerCase() || "";
      let targetDevice = appleTVDevices.find((d: { name: string }) => 
        currentSource.includes(d.name.toLowerCase()) || 
        d.name.toLowerCase().includes(currentSource.replace("apple tv", "").trim())
      );
      
      // If no match, use first connected Apple TV or first available
      if (!targetDevice) {
        targetDevice = appleTVDevices.find((d: { is_connected: boolean }) => d.is_connected) || appleTVDevices[0];
      }
      
      console.log(`Sending ${command} to Apple TV: ${targetDevice.name} (${targetDevice.id})`);
      
      // Send the command
      const response = await fetch(`/api/appletv/devices/${targetDevice.id}/remote/${command}`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error("Apple TV command failed:", error);
      }
    } catch (error) {
      console.warn("Failed to send Apple TV command:", error);
    } finally {
      setIsRemoteLoading(false);
      setTimeout(() => setLastRemoteCommand(null), 200);
    }
  }, [mediaRoom.currentSourceName]);

  // Compact view for lists
  if (compact) {
    return (
      <Card
        hoverable
        padding="sm"
        className={`
          transition-all duration-200
          ${mediaRoom.isPoweredOn 
            ? "bg-gradient-to-br from-slate-500/10 to-transparent" 
            : "bg-gradient-to-br from-[var(--surface)]/50 to-transparent"
          }
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handlePowerToggle}
              disabled={isUpdating}
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                transition-all duration-200
                ${mediaRoom.isPoweredOn 
                  ? "bg-slate-600 text-white" 
                  : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
                }
                ${isUpdating ? "opacity-50" : "hover:opacity-80"}
              `}
            >
              <MediaIcon className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {displayName}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {mediaRoom.isPoweredOn 
                  ? mediaRoom.currentSourceName || "Playing" 
                  : "Off"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mediaRoom.isPoweredOn && (
              <span className={`text-sm font-medium ${canControlVolume ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)] line-through"}`}>
                {mediaRoom.volumePercent}%
              </span>
            )}
            {mediaRoom.isPoweredOn && (
              <button
                onClick={canMute ? handleMuteToggle : undefined}
                disabled={isUpdating || !canMute}
                title={canMute ? (mediaRoom.isMuted ? "Unmute" : "Mute") : "Mute not available"}
                className={`
                  p-1.5 rounded-lg transition-colors relative
                  ${!canMute 
                    ? "opacity-40 cursor-not-allowed" 
                    : mediaRoom.isMuted 
                      ? "bg-red-500/20 text-red-500" 
                      : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
                  }
                `}
              >
                {mediaRoom.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {!canMute && (
                  <Ban className="w-3 h-3 absolute -top-0.5 -right-0.5 text-[var(--text-tertiary)]" />
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Source selector - show when OFF and has sources */}
        {!mediaRoom.isPoweredOn && hasSources && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-[10px] font-medium text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">
              Select source to power on
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mediaRoom.availableProviders.slice(0, 6).map((source, index) => (
                <button
                  key={index}
                  onClick={() => handleSourceSelect(index)}
                  disabled={isUpdating}
                  className={`
                    px-2.5 py-1 text-xs rounded-lg transition-all
                    ${index === 0 
                      ? "bg-slate-600 text-white" 
                      : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-slate-500/20 hover:text-slate-300"
                    }
                    ${isUpdating ? "opacity-50" : ""}
                  `}
                >
                  {source}
                </button>
              ))}
              {mediaRoom.availableProviders.length > 6 && (
                <span className="px-2 py-1 text-xs text-[var(--text-tertiary)]">
                  +{mediaRoom.availableProviders.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Full card view
  return (
    <Card 
      padding="md" 
      className={`
        transition-all duration-200
        ${mediaRoom.isPoweredOn 
          ? "bg-gradient-to-br from-slate-500/10 to-transparent" 
          : ""
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center shrink-0
            transition-all duration-200
            ${mediaRoom.isPoweredOn 
              ? "bg-slate-600 text-white shadow-lg shadow-slate-600/30" 
              : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
            }
          `}>
            <MediaIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--text-primary)] truncate">
              {displayName}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {mediaRoom.isPoweredOn && mediaRoom.currentSourceName
                ? mediaRoom.currentSourceName
                : "Off"
              }
            </p>
          </div>
        </div>
        
        {/* Power Toggle */}
        <button
          onClick={handlePowerToggle}
          disabled={isUpdating}
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3
            transition-all duration-200
            ${mediaRoom.isPoweredOn 
              ? "bg-slate-600 text-white shadow-lg shadow-slate-600/30 hover:bg-slate-700" 
              : "bg-[var(--surface-hover)] text-[var(--text-tertiary)] hover:bg-slate-600 hover:text-white hover:shadow-lg hover:shadow-slate-600/30"
            }
            ${isUpdating ? "opacity-50" : ""}
          `}
          title={mediaRoom.isPoweredOn ? "Turn off" : "Turn on"}
        >
          <Power className="w-5 h-5" />
        </button>
      </div>

      {/* Source Selector */}
      {mediaRoom.availableProviders.length > 0 && (
        <div className="mt-3">
          <div className="relative">
            <button
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              disabled={isUpdating}
              className={`
                w-full flex items-center justify-between
                px-3 py-2 rounded-lg
                transition-colors
                text-left text-sm
                ${mediaRoom.isPoweredOn 
                  ? "bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                  : "bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30"
                }
              `}
            >
              <span className={`${mediaRoom.isPoweredOn ? "text-[var(--text-secondary)]" : "text-slate-400"}`}>
                Select a source...
              </span>
              <ChevronDown className={`
                w-4 h-4 ${mediaRoom.isPoweredOn ? "text-[var(--text-tertiary)]" : "text-slate-400"}
                transition-transform duration-200
                ${showSourcePicker ? "rotate-180" : ""}
              `} />
            </button>
            
            {/* Source Dropdown */}
            {showSourcePicker && (
              <div className="
                absolute top-full left-0 right-0 mt-1 z-10
                bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)]
                max-h-48 overflow-y-auto
              ">
                {mediaRoom.availableProviders.map((source, index) => (
                  <button
                    key={index}
                    onClick={() => handleSourceSelect(index)}
                    className={`
                      w-full px-3 py-2 text-left text-sm
                      hover:bg-[var(--surface-hover)] transition-colors
                      ${mediaRoom.currentProviderId === index 
                        ? "bg-slate-500/10 text-slate-300 font-medium" 
                        : "text-[var(--text-primary)]"
                      }
                      ${index === 0 ? "rounded-t-lg" : ""}
                      ${index === mediaRoom.availableProviders.length - 1 ? "rounded-b-lg" : ""}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{source}</span>
                      {mediaRoom.currentProviderId === index && (
                        <span className="text-xs text-slate-400">●</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transport Controls - only show when powered on */}
      {mediaRoom.isPoweredOn && (
        <div className="mt-3">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={isUpdating}
              className="p-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              title="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={handlePlay}
              disabled={isUpdating}
              className="p-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white transition-colors disabled:opacity-50"
              title="Play"
            >
              <Play className="w-5 h-5" />
            </button>
            <button
              onClick={handlePause}
              disabled={isUpdating}
              className="p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              title="Pause"
            >
              <Pause className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={isUpdating}
              className="p-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              title="Next"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Apple TV D-Pad Controls - show when Apple TV is the source */}
      {mediaRoom.isPoweredOn && isAppleTV && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {/* Toggle button for D-Pad */}
          <button
            onClick={() => setShowDPad(!showDPad)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-sm transition-colors mb-3"
          >
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-300">Apple TV Remote</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${showDPad ? "rotate-180" : ""}`} />
          </button>

          {/* D-Pad and navigation controls */}
          {showDPad && (
            <div className="space-y-3">
              {/* Loading indicator */}
              {isRemoteLoading && (
                <div className="flex justify-center">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                </div>
              )}

              {/* D-Pad Navigation */}
              <div className="flex justify-center">
                <div className="grid grid-cols-3 gap-1">
                  {/* Top row */}
                  <div />
                  <DPadButton 
                    onClick={() => sendAppleTVCommand("up")} 
                    disabled={isRemoteLoading}
                    title="Up"
                    className={lastRemoteCommand === "up" ? "bg-zinc-600" : ""}
                  >
                    <ChevronUp className="w-5 h-5" />
                  </DPadButton>
                  <div />

                  {/* Middle row */}
                  <DPadButton 
                    onClick={() => sendAppleTVCommand("left")} 
                    disabled={isRemoteLoading}
                    title="Left"
                    className={lastRemoteCommand === "left" ? "bg-zinc-600" : ""}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </DPadButton>
                  <DPadButton 
                    onClick={() => sendAppleTVCommand("select")} 
                    disabled={isRemoteLoading}
                    title="Select"
                    className={`w-12 h-12 bg-zinc-700 hover:bg-zinc-600 ${lastRemoteCommand === "select" ? "bg-zinc-500" : ""}`}
                  >
                    <Circle className="w-6 h-6" />
                  </DPadButton>
                  <DPadButton 
                    onClick={() => sendAppleTVCommand("right")} 
                    disabled={isRemoteLoading}
                    title="Right"
                    className={lastRemoteCommand === "right" ? "bg-zinc-600" : ""}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </DPadButton>

                  {/* Bottom row */}
                  <div />
                  <DPadButton 
                    onClick={() => sendAppleTVCommand("down")} 
                    disabled={isRemoteLoading}
                    title="Down"
                    className={lastRemoteCommand === "down" ? "bg-zinc-600" : ""}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </DPadButton>
                  <div />
                </div>
              </div>

              {/* Menu and Home buttons */}
              <div className="flex justify-center gap-3">
                <DPadButton 
                  onClick={() => sendAppleTVCommand("menu")} 
                  disabled={isRemoteLoading}
                  title="Menu / Back"
                  className={lastRemoteCommand === "menu" ? "bg-zinc-600" : ""}
                >
                  <Menu className="w-4 h-4" />
                </DPadButton>
                <DPadButton 
                  onClick={() => sendAppleTVCommand("home")} 
                  disabled={isRemoteLoading}
                  title="Home"
                  className={lastRemoteCommand === "home" ? "bg-zinc-600" : ""}
                >
                  <Home className="w-4 h-4" />
                </DPadButton>
                <DPadButton 
                  onClick={() => sendAppleTVCommand("play_pause")} 
                  disabled={isRemoteLoading}
                  title="Play/Pause"
                  className={lastRemoteCommand === "play_pause" ? "bg-zinc-600" : ""}
                >
                  <Play className="w-4 h-4" />
                </DPadButton>
              </div>

              <p className="text-xs text-center text-zinc-500 mt-2">
                Requires pyatv service running on your network
              </p>
            </div>
          )}
        </div>
      )}

      {/* Volume Slider - only show when powered on and has volume control */}
      {mediaRoom.isPoweredOn && canControlVolume && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Slider
              value={[localVolume !== null ? localVolume : mediaRoom.volumePercent]}
              onValueChange={handleVolumeChange}
              onValueCommit={handleVolumeCommit}
              min={0}
              max={100}
              step={1}
              disabled={isUpdating || mediaRoom.isMuted}
              color="accent"
              size="sm"
              className="flex-1"
            />
            <span className="text-sm font-medium text-[var(--text-secondary)] w-10 text-right">
              {localVolume !== null ? localVolume : mediaRoom.volumePercent}%
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

export default MediaRoomCard;
