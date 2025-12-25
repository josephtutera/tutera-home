"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isConnected: boolean;
  isConnecting: boolean;
  processorIp: string | null;
  authKey: string | null;
  error: string | null;
  
  // Actions
  setConnection: (processorIp: string, authKey: string) => void;
  setConnecting: (isConnecting: boolean) => void;
  setError: (error: string | null) => void;
  disconnect: () => void;
  
  // API helpers
  getAuthHeaders: () => Record<string, string>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isConnecting: false,
      processorIp: null,
      authKey: null,
      error: null,

      setConnection: (processorIp, authKey) =>
        set({
          isConnected: true,
          isConnecting: false,
          processorIp,
          authKey,
          error: null,
        }),

      setConnecting: (isConnecting) => set({ isConnecting }),

      setError: (error) =>
        set({
          error,
          isConnecting: false,
        }),

      disconnect: () =>
        set({
          isConnected: false,
          isConnecting: false,
          processorIp: null,
          authKey: null,
          error: null,
        }),

      getAuthHeaders: (): Record<string, string> => {
        const { processorIp, authKey } = get();
        if (!processorIp || !authKey) {
          return {} as Record<string, string>;
        }
        return {
          "x-processor-ip": processorIp,
          "x-auth-key": authKey,
        };
      },
    }),
    {
      name: "crestron-auth",
      partialize: (state) => ({
        processorIp: state.processorIp,
        authKey: state.authKey,
        isConnected: state.isConnected,
      }),
    }
  )
);

// Login action (separate to handle async)
export async function login(processorIp: string, authToken: string): Promise<boolean> {
  const { setConnecting, setConnection, setError } = useAuthStore.getState();
  
  setConnecting(true);
  setError(null);

  try {
    const response = await fetch("/api/crestron/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processorIp, authToken }),
    });

    const data = await response.json();

    if (data.success && data.authKey) {
      setConnection(processorIp, data.authKey);
      return true;
    }

    setError(data.error || "Failed to connect");
    return false;
  } catch (error) {
    setError(error instanceof Error ? error.message : "Connection failed");
    return false;
  }
}

