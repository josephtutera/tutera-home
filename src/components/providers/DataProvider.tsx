"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { fetchAllData, useDeviceStore, checkTemperatureSatisfaction } from "@/stores/deviceStore";
import { useThemeStore, applyTheme } from "@/stores/themeStore";

// Adaptive polling intervals based on idle time (in milliseconds)
const POLLING_INTERVALS = {
  ACTIVE: 3000,           // 3 seconds when active
  IDLE_1_MIN: 10000,      // 10 seconds after 1 minute idle
  IDLE_5_MIN: 60000,      // 1 minute after 5 minutes idle
  IDLE_10_MIN: 1800000,   // 30 minutes after 10 minutes idle
};

// Idle time thresholds (in milliseconds)
const IDLE_THRESHOLDS = {
  ONE_MINUTE: 60000,
  FIVE_MINUTES: 300000,
  TEN_MINUTES: 600000,
};

// Get the appropriate polling interval based on idle duration
function getPollingInterval(idleDuration: number): number {
  if (idleDuration >= IDLE_THRESHOLDS.TEN_MINUTES) {
    return POLLING_INTERVALS.IDLE_10_MIN;
  }
  if (idleDuration >= IDLE_THRESHOLDS.FIVE_MINUTES) {
    return POLLING_INTERVALS.IDLE_5_MIN;
  }
  if (idleDuration >= IDLE_THRESHOLDS.ONE_MINUTE) {
    return POLLING_INTERVALS.IDLE_1_MIN;
  }
  return POLLING_INTERVALS.ACTIVE;
}

interface DataProviderProps {
  children: React.ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { isConnected } = useAuthStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleCheckRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialFetch = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Track last activity time and current polling interval
  const lastActivityRef = useRef<number>(Date.now());
  const currentIntervalRef = useRef<number>(POLLING_INTERVALS.ACTIVE);
  const isPageVisibleRef = useRef<boolean>(true);

  // Suppress Next.js dev overlay async params/searchParams warnings (dev-only, doesn't affect production)
  // These warnings are triggered by the component inspector trying to serialize Promise props
  // Note: Next.js routes these through console.error, not console.warn
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalWarn = console.warn;
      const originalError = console.error;
      
      const shouldSuppress = (message: unknown): boolean => {
        return typeof message === 'string' && 
          (message.includes('searchParams') || message.includes('params are being enumerated')) &&
          message.includes('Promise');
      };
      
      console.warn = (...args: Parameters<typeof console.warn>) => {
        if (shouldSuppress(args[0])) return;
        originalWarn.apply(console, args);
      };
      
      console.error = (...args: Parameters<typeof console.error>) => {
        if (shouldSuppress(args[0])) return;
        originalError.apply(console, args);
      };
      
      return () => {
        console.warn = originalWarn;
        console.error = originalError;
      };
    }
  }, []);

  // Track hydration state
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Initialize theme on mount
  const { theme } = useThemeStore();
  useEffect(() => {
    applyTheme(theme);
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentTheme = useThemeStore.getState().theme;
      if (currentTheme === "system") {
        applyTheme("system");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Function to perform a fetch
  const doFetch = useCallback(async () => {
    await fetchAllData(false, true);
    await checkTemperatureSatisfaction();
  }, []);

  // Function to restart the polling interval with a new duration
  const restartPolling = useCallback((interval: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    currentIntervalRef.current = interval;
    intervalRef.current = setInterval(doFetch, interval);
  }, [doFetch]);

  // Handle user activity - reset idle timer and potentially increase polling rate
  const handleActivity = useCallback(() => {
    const wasIdle = Date.now() - lastActivityRef.current >= IDLE_THRESHOLDS.ONE_MINUTE;
    lastActivityRef.current = Date.now();
    
    // If coming back from idle state, immediately refresh and reset to active polling
    if (wasIdle && isPageVisibleRef.current) {
      // Immediate refresh when becoming active after being idle
      doFetch();
      // Reset to active polling interval
      if (currentIntervalRef.current !== POLLING_INTERVALS.ACTIVE) {
        restartPolling(POLLING_INTERVALS.ACTIVE);
      }
    }
  }, [doFetch, restartPolling]);

  // Handle page visibility changes
  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    const wasHidden = !isPageVisibleRef.current;
    isPageVisibleRef.current = isVisible;
    
    if (isVisible && wasHidden) {
      // Page became visible - treat as activity, immediate refresh
      lastActivityRef.current = Date.now();
      doFetch();
      restartPolling(POLLING_INTERVALS.ACTIVE);
    } else if (!isVisible) {
      // Page hidden - stop polling entirely to save resources
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [doFetch, restartPolling]);

  // Check idle state and adjust polling interval accordingly
  const checkIdleState = useCallback(() => {
    // Skip if page is hidden (we've already stopped polling)
    if (!isPageVisibleRef.current) return;
    
    const idleDuration = Date.now() - lastActivityRef.current;
    const newInterval = getPollingInterval(idleDuration);
    
    // Only restart polling if interval changed
    if (newInterval !== currentIntervalRef.current) {
      restartPolling(newInterval);
    }
  }, [restartPolling]);

  // Set up activity tracking and adaptive polling
  useEffect(() => {
    // Wait for hydration before checking connection
    if (!isHydrated) {
      return;
    }

    // Only run when connected
    if (!isConnected) {
      hasInitialFetch.current = false;
      return;
    }

    // Initial fetch
    if (!hasInitialFetch.current) {
      hasInitialFetch.current = true;
      fetchAllData();
    }

    // Reset activity tracking
    lastActivityRef.current = Date.now();
    currentIntervalRef.current = POLLING_INTERVALS.ACTIVE;
    isPageVisibleRef.current = document.visibilityState === 'visible';

    // Set up polling interval with silent=true to avoid UI flicker
    intervalRef.current = setInterval(doFetch, POLLING_INTERVALS.ACTIVE);

    // Set up idle state check (runs every 10 seconds to adjust polling as needed)
    idleCheckRef.current = setInterval(checkIdleState, 10000);

    // Activity event listeners - use passive for performance
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const options = { passive: true };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, options);
    });

    // Page visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount or when connection changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (idleCheckRef.current) {
        clearInterval(idleCheckRef.current);
        idleCheckRef.current = null;
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, isHydrated, doFetch, handleActivity, handleVisibilityChange, checkIdleState]);

  return <>{children}</>;
}

export default DataProvider;
