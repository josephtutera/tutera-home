"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Palette,
  Sun,
  Moon,
  Sunset,
  Coffee,
  Film,
  PartyPopper,
  Bed,
  Home,
  Play,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Scene } from "@/lib/crestron/types";
import { recallScene } from "@/stores/deviceStore";

interface SceneCardProps {
  scene: Scene;
  compact?: boolean;
}

// Map scene names to icons (simple heuristic)
function getSceneIcon(name: string) {
  const lowercaseName = name.toLowerCase();
  
  if (lowercaseName.includes("morning") || lowercaseName.includes("wake")) return Sun;
  if (lowercaseName.includes("night") || lowercaseName.includes("sleep") || lowercaseName.includes("bedtime")) return Moon;
  if (lowercaseName.includes("evening") || lowercaseName.includes("sunset") || lowercaseName.includes("dinner")) return Sunset;
  if (lowercaseName.includes("coffee") || lowercaseName.includes("breakfast")) return Coffee;
  if (lowercaseName.includes("movie") || lowercaseName.includes("theater") || lowercaseName.includes("cinema")) return Film;
  if (lowercaseName.includes("party") || lowercaseName.includes("entertain")) return PartyPopper;
  if (lowercaseName.includes("bed") || lowercaseName.includes("relax")) return Bed;
  if (lowercaseName.includes("away") || lowercaseName.includes("vacation") || lowercaseName.includes("goodbye")) return Home;
  
  return Palette;
}

// Generate a consistent color based on scene name
function getSceneColor(name: string): string {
  const colors = [
    "#F59E0B", // Amber
    "#3B82F6", // Blue
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#10B981", // Emerald
    "#F97316", // Orange
    "#06B6D4", // Cyan
    "#6366F1", // Indigo
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function SceneCard({ scene, compact = false }: SceneCardProps) {
  const [isActivating, setIsActivating] = useState(false);
  const Icon = getSceneIcon(scene.name);
  const color = getSceneColor(scene.name);
  const isActive = scene.isActive;

  const handleActivate = useCallback(async () => {
    setIsActivating(true);
    await recallScene(scene.id);
    // Wait a moment before allowing another activation
    setTimeout(() => setIsActivating(false), 1000);
  }, [scene.id]);

  if (compact) {
    return (
      <motion.button
        onClick={handleActivate}
        disabled={isActivating}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          w-full p-3 rounded-xl text-left border
          transition-all duration-300
          ${isActive 
            ? "ring-2 ring-offset-2 shadow-sm" 
            : "hover:bg-[var(--surface-hover)]"
          }
          ${isActivating ? "opacity-70" : ""}
        `}
        style={{
          backgroundColor: isActive ? `${color}20` : "var(--surface)",
          borderColor: isActive ? color : "var(--border-light)",
          // @ts-expect-error - ring color via CSS variable
          "--tw-ring-color": isActive ? color : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-[var(--text-primary)] truncate">
              {scene.name}
            </p>
            {isActive && (
              <p className="text-xs" style={{ color }}>
                Active
              </p>
            )}
          </div>
          {isActivating && (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color }} />
          )}
        </div>
      </motion.button>
    );
  }

  return (
    <Card
      padding="none"
      className={`
        overflow-hidden transition-all duration-300
        ${isActive ? "ring-2 ring-offset-2" : ""}
      `}
      style={{
        // @ts-expect-error - ring color via CSS variable
        "--tw-ring-color": isActive ? color : undefined,
      }}
    >
      <motion.button
        onClick={handleActivate}
        disabled={isActivating}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full p-5 text-left"
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, transparent 60%)`,
          }}
        />
        
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="w-7 h-7" style={{ color }} />
            </div>
            
            {isActivating ? (
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color }} />
            ) : (
              <Play
                className="w-5 h-5 text-[var(--text-tertiary)]"
              />
            )}
          </div>

          <h3 className="font-semibold text-lg text-[var(--text-primary)] mb-1">
            {scene.name}
          </h3>
          
          {isActive ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
              Active
            </span>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Tap to activate
            </p>
          )}
        </div>
      </motion.button>
    </Card>
  );
}

// Scene grid for dashboard
interface SceneGridProps {
  scenes: Scene[];
  maxVisible?: number;
}

export function SceneGrid({ scenes, maxVisible = 4 }: SceneGridProps) {
  const visibleScenes = scenes.slice(0, maxVisible);
  const remaining = scenes.length - maxVisible;

  return (
    <div className="grid grid-cols-2 gap-3">
      {visibleScenes.map((scene) => (
        <SceneCard key={scene.id} scene={scene} compact />
      ))}
      {remaining > 0 && (
        <div className="col-span-2 text-center py-2">
          <span className="text-sm text-[var(--text-secondary)]">
            +{remaining} more scenes
          </span>
        </div>
      )}
    </div>
  );
}

export default SceneCard;

