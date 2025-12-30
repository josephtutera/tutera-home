"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "tutera-theme",
    }
  )
);

// Apply theme to document
export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  
  const root = document.documentElement;
  
  if (theme === "system") {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", systemDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

// Initialize theme on app load
export function initializeTheme() {
  if (typeof window === "undefined") return;
  
  const stored = localStorage.getItem("tutera-theme");
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      applyTheme(state.theme || "light");
    } catch {
      applyTheme("light");
    }
  }
  
  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      applyTheme("system");
    }
  });
}

