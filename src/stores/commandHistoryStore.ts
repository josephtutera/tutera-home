"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DeviceStateSnapshot } from "@/lib/ai/command-processor";

// Executed action record
export interface ExecutedAction {
  type: "light" | "climate" | "media" | "scene";
  functionName: string;
  args: Record<string, unknown>;
  deviceSnapshots: DeviceStateSnapshot[];
}

// Full command record for history
export interface CommandRecord {
  id: string;
  timestamp: Date;
  userInput: string;
  aiResponse: string;
  actions: ExecutedAction[];
  wasUndone: boolean;
}

interface CommandHistoryState {
  // Command history (most recent first)
  history: CommandRecord[];
  
  // Maximum number of commands to keep
  maxHistorySize: number;
  
  // Actions
  addCommand: (record: Omit<CommandRecord, "id" | "timestamp" | "wasUndone">) => string;
  markUndone: (commandId: string) => void;
  getLastUndoableCommand: () => CommandRecord | null;
  clearHistory: () => void;
  
  // Get device snapshots for undo
  getSnapshotsForUndo: (commandId: string) => DeviceStateSnapshot[];
}

// Generate unique command ID
function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useCommandHistoryStore = create<CommandHistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      maxHistorySize: 50,

      addCommand: (record) => {
        const id = generateCommandId();
        const newRecord: CommandRecord = {
          ...record,
          id,
          timestamp: new Date(),
          wasUndone: false,
        };

        set((state) => {
          const newHistory = [newRecord, ...state.history];
          // Trim history if it exceeds max size
          if (newHistory.length > state.maxHistorySize) {
            newHistory.splice(state.maxHistorySize);
          }
          return { history: newHistory };
        });

        return id;
      },

      markUndone: (commandId) => {
        set((state) => ({
          history: state.history.map((cmd) =>
            cmd.id === commandId ? { ...cmd, wasUndone: true } : cmd
          ),
        }));
      },

      getLastUndoableCommand: () => {
        const { history } = get();
        // Find the most recent command that hasn't been undone
        return history.find((cmd) => !cmd.wasUndone) || null;
      },

      clearHistory: () => {
        set({ history: [] });
      },

      getSnapshotsForUndo: (commandId) => {
        const { history } = get();
        const command = history.find((cmd) => cmd.id === commandId);
        if (!command) return [];
        
        // Collect all device snapshots from all actions in this command
        return command.actions.flatMap((action) => action.deviceSnapshots);
      },
    }),
    {
      name: "ai-command-history",
      partialize: (state) => ({
        history: state.history.slice(0, 20), // Only persist last 20 commands
      }),
      // Custom serializer for Date objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Revive Date objects
          if (parsed.state?.history) {
            parsed.state.history = parsed.state.history.map((cmd: CommandRecord) => ({
              ...cmd,
              timestamp: new Date(cmd.timestamp),
            }));
          }
          return parsed;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

// Helper hook to get recent commands for display
export function useRecentCommands(limit: number = 5): CommandRecord[] {
  const history = useCommandHistoryStore((state) => state.history);
  return history.slice(0, limit);
}

// Helper to check if undo is available
export function useCanUndo(): boolean {
  const history = useCommandHistoryStore((state) => state.history);
  return history.some((cmd) => !cmd.wasUndone);
}
