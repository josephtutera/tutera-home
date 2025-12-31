"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Palette, RefreshCw, ChevronDown, Home, Lightbulb, Music, Zap } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { SceneCard } from "@/components/devices/SceneCard";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchAllData } from "@/stores/deviceStore";
import type { Scene, SceneSource } from "@/lib/crestron/types";

// Source group configuration
const SOURCE_CONFIG: Record<SceneSource, { label: string; color: string; order: number }> = {
  lutron: { label: 'Lighting', color: '#EAB308', order: 1 },
  crestron: { label: 'Crestron', color: '#6B7280', order: 2 },
  action: { label: 'Actions', color: '#3B82F6', order: 3 },
  unknown: { label: 'Other', color: '#9CA3AF', order: 4 },
};

// Group scenes by source type
function groupScenesBySource(scenes: Scene[]): { source: SceneSource; scenes: Scene[] }[] {
  const groups = new Map<SceneSource, Scene[]>();
  
  scenes.forEach(scene => {
    const source = scene.source || 'unknown';
    if (!groups.has(source)) {
      groups.set(source, []);
    }
    groups.get(source)!.push(scene);
  });
  
  // Convert to array and sort by defined order
  return Array.from(groups.entries())
    .map(([source, scenes]) => ({ source, scenes }))
    .sort((a, b) => SOURCE_CONFIG[a.source].order - SOURCE_CONFIG[b.source].order);
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface RoomSceneGroup {
  roomName: string;
  roomId: string | undefined;
  scenes: Scene[];
}

export default function ScenesPage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  // Use useShallow to prevent re-renders when object references change but values are the same
  const { scenes, isLoading } = useDeviceStore(useShallow((state) => ({
    scenes: state.scenes,
    isLoading: state.isLoading,
  })));
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  // Group scenes by room
  const scenesByRoom = useMemo(() => {
    const groups = new Map<string, RoomSceneGroup>();
    
    scenes.forEach(scene => {
      const roomKey = scene.roomName || "Unassigned";
      
      if (!groups.has(roomKey)) {
        groups.set(roomKey, {
          roomName: roomKey,
          roomId: scene.roomId,
          scenes: [],
        });
      }
      groups.get(roomKey)!.scenes.push(scene);
    });
    
    // Convert to array and sort by room name (Unassigned at the end)
    return Array.from(groups.values()).sort((a, b) => {
      if (a.roomName === "Unassigned") return 1;
      if (b.roomName === "Unassigned") return -1;
      return a.roomName.localeCompare(b.roomName);
    });
  }, [scenes]);

  // Expand first few rooms by default on initial load
  useEffect(() => {
    if (scenesByRoom.length > 0 && expandedRooms.size === 0) {
      // Auto-expand first 3 rooms
      const initialExpanded = new Set(
        scenesByRoom.slice(0, 3).map(g => g.roomName)
      );
      setExpandedRooms(initialExpanded);
    }
  }, [scenesByRoom, expandedRooms.size]);

  const toggleRoom = (roomName: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomName)) {
        next.delete(roomName);
      } else {
        next.add(roomName);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRooms(new Set(scenesByRoom.map(g => g.roomName)));
  };

  const collapseAll = () => {
    setExpandedRooms(new Set());
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Scenes
              </h1>
              <RefreshedAt />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
            >
              Collapse All
            </button>
            <button
              onClick={() => fetchAllData()}
              disabled={isLoading}
              className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-6 text-sm text-[var(--text-secondary)]">
          <span>{scenes.length} scenes</span>
          <span>•</span>
          <span>{scenesByRoom.length} rooms</span>
        </div>

        {/* Scenes by Room */}
        {scenesByRoom.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {scenesByRoom.map((group) => {
              const isExpanded = expandedRooms.has(group.roomName);
              
              return (
                <motion.div key={group.roomName} variants={itemVariants}>
                  <Card padding="none" className="overflow-hidden">
                    {/* Room Header */}
                    <button
                      onClick={() => toggleRoom(group.roomName)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                          <Home className="w-5 h-5 text-[var(--accent)]" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {group.roomName}
                          </h3>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {group.scenes.length} scene{group.scenes.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-[var(--text-secondary)] transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Scenes grouped by source */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-4">
                        {groupScenesBySource(group.scenes).map((sourceGroup, idx) => {
                          const config = SOURCE_CONFIG[sourceGroup.source];
                          const SourceIcon = sourceGroup.source === 'lutron' ? Lightbulb 
                            : sourceGroup.source === 'crestron' ? Music 
                            : sourceGroup.source === 'action' ? Zap 
                            : Palette;
                          
                          return (
                            <div key={sourceGroup.source}>
                              {/* Divider line (except for first group) */}
                              {idx > 0 && (
                                <div className="border-t border-[var(--border-light)] mb-4" />
                              )}
                              
                              {/* Source header */}
                              <div className="flex items-center gap-2 mb-3">
                                <SourceIcon 
                                  className="w-4 h-4" 
                                  style={{ color: config.color }} 
                                />
                                <span 
                                  className="text-sm font-medium"
                                  style={{ color: config.color }}
                                >
                                  {config.label}
                                </span>
                                <span className="text-xs text-[var(--text-tertiary)]">
                                  ({sourceGroup.scenes.length})
                                </span>
                              </div>
                              
                              {/* Scenes grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {sourceGroup.scenes.map((scene) => (
                                  <SceneCard key={scene.id} scene={scene} compact />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <Palette className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              No Scenes Found
            </h3>
            <p className="text-[var(--text-secondary)]">
              Scenes configured in your Crestron system will appear here.
            </p>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
