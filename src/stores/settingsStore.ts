"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ZoneControlStyle = "buttons" | "slider";

interface SettingsState {
  // Zone lighting control style preference
  zoneControlStyle: ZoneControlStyle;
  setZoneControlStyle: (style: ZoneControlStyle) => void;
  
  // Slider activation delay in milliseconds (for touch devices)
  sliderActivationDelay: number;
  setSliderActivationDelay: (delay: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default to buttons for safer touch experience
      zoneControlStyle: "buttons",
      setZoneControlStyle: (style) => set({ zoneControlStyle: style }),
      
      // Default 300ms press-and-hold to activate slider
      sliderActivationDelay: 300,
      setSliderActivationDelay: (delay) => set({ sliderActivationDelay: delay }),
    }),
    {
      name: "tutera-settings",
    }
  )
);
