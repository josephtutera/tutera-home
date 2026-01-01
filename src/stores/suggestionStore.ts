"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CommandUsage {
  command: string;
  count: number;
  lastUsed: number; // timestamp
}

interface SuggestionState {
  // AI-provided contextual suggestions (updated per response)
  contextualSuggestions: string[];
  
  // User's frequently used commands
  frequentCommands: CommandUsage[];
  
  // Default suggestions when nothing else is available
  defaultSuggestions: string[];
  
  // Actions
  setContextualSuggestions: (suggestions: string[]) => void;
  clearContextualSuggestions: () => void;
  recordCommand: (command: string) => void;
  getTopSuggestions: (limit?: number) => string[];
  resetFrequentCommands: () => void;
}

const DEFAULT_SUGGESTIONS = [
  "Turn off all lights",
  "What's on?",
  "Set house to 70°",
];

// Normalize command for comparison (lowercase, trim whitespace)
function normalizeCommand(command: string): string {
  return command.toLowerCase().trim();
}

export const useSuggestionStore = create<SuggestionState>()(
  persist(
    (set, get) => ({
      contextualSuggestions: [],
      frequentCommands: [],
      defaultSuggestions: DEFAULT_SUGGESTIONS,

      setContextualSuggestions: (suggestions) => {
        set({ contextualSuggestions: suggestions });
      },

      clearContextualSuggestions: () => {
        set({ contextualSuggestions: [] });
      },

      recordCommand: (command) => {
        const normalized = normalizeCommand(command);
        
        // Skip very short commands or common responses like "yes", "no"
        if (normalized.length < 5 || ["yes", "no", "ok", "okay", "sure"].includes(normalized)) {
          return;
        }

        set((state) => {
          const existing = state.frequentCommands.find(
            (c) => normalizeCommand(c.command) === normalized
          );

          if (existing) {
            // Increment count and update timestamp
            return {
              frequentCommands: state.frequentCommands.map((c) =>
                normalizeCommand(c.command) === normalized
                  ? { ...c, count: c.count + 1, lastUsed: Date.now() }
                  : c
              ),
            };
          } else {
            // Add new command
            const newFrequentCommands = [
              ...state.frequentCommands,
              { command, count: 1, lastUsed: Date.now() },
            ];
            
            // Keep only top 50 most used commands
            return {
              frequentCommands: newFrequentCommands
                .sort((a, b) => b.count - a.count)
                .slice(0, 50),
            };
          }
        });
      },

      getTopSuggestions: (limit = 6) => {
        const state = get();
        
        // Priority 1: Contextual suggestions from AI (most relevant)
        if (state.contextualSuggestions.length > 0) {
          return state.contextualSuggestions.slice(0, limit);
        }
        
        // Priority 2: Frequent commands (weighted by count and recency)
        if (state.frequentCommands.length > 0) {
          const now = Date.now();
          const oneWeek = 7 * 24 * 60 * 60 * 1000;
          
          // Score based on count and recency
          const scored = state.frequentCommands.map((c) => {
            const recencyBoost = Math.max(0, 1 - (now - c.lastUsed) / oneWeek);
            const score = c.count + recencyBoost * 2;
            return { ...c, score };
          });
          
          const sorted = scored.sort((a, b) => b.score - a.score);
          const top = sorted.slice(0, limit).map((c) => c.command);
          
          // If we have fewer frequent commands than limit, fill with defaults
          if (top.length < limit) {
            const remaining = state.defaultSuggestions.filter(
              (d) => !top.some((t) => normalizeCommand(t) === normalizeCommand(d))
            );
            return [...top, ...remaining].slice(0, limit);
          }
          
          return top;
        }
        
        // Priority 3: Default suggestions
        return state.defaultSuggestions.slice(0, limit);
      },

      resetFrequentCommands: () => {
        set({ frequentCommands: [], contextualSuggestions: [] });
      },
    }),
    {
      name: "ai-suggestions",
      partialize: (state) => ({
        frequentCommands: state.frequentCommands,
      }),
    }
  )
);
