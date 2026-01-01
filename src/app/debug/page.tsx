"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function DebugPage() {
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { getAuthHeaders, isConnected, processorIp, authKey } = useAuthStore();

  // Wait for zustand persist hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  const probeEndpoints = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeaders();
      const response = await fetch("/api/crestron/debug", {
        headers,
      });
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to probe endpoints");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      probeEndpoints();
    }
  }, [isConnected]);

  // Wait for hydration before checking auth
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <h1 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">Debug: Crestron API Probe</h1>
        <p className="text-[var(--text-secondary)]">Loading authentication...</p>
      </div>
    );
  }

  // Debug: show auth state
  const authHeaders = getAuthHeaders();
  const hasAuth = processorIp && authKey;

  if (!hasAuth) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <h1 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">Debug: Crestron API Probe</h1>
        <p className="text-red-500 mb-4">Not connected to Crestron processor.</p>
        <p className="text-[var(--text-secondary)] mb-4">
          processorIp: {processorIp || "null"}<br/>
          authKey: {authKey ? "****" : "null"}
        </p>
        <a href="/login" className="px-4 py-2 bg-blue-500 text-white rounded-lg inline-block">
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <h1 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">Debug: Crestron API Probe</h1>
      <p className="text-[var(--text-secondary)] mb-4">
        Probing Crestron processor for display-related endpoints...
      </p>
      
      <div className="p-3 bg-blue-500/10 rounded-lg mb-4 text-sm">
        <p className="text-[var(--text-secondary)]">
          <strong>Auth Headers:</strong> {JSON.stringify(authHeaders)}
        </p>
      </div>
      
      <button
        onClick={probeEndpoints}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg mb-6 disabled:opacity-50"
      >
        {loading ? "Probing..." : "Probe Again"}
      </button>

      {error && (
        <div className="p-4 bg-red-500/20 text-red-500 rounded-lg mb-4">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Video Rooms */}
          <div className="p-4 rounded-lg border border-green-500 bg-green-500/10">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              📺 Video Rooms (/cws/api/videorooms)
            </h2>
            <pre className="text-xs bg-black/20 p-3 rounded overflow-auto max-h-96 text-[var(--text-secondary)]">
              {JSON.stringify((results as Record<string, unknown>).videoRooms, null, 2)}
            </pre>
          </div>

          {/* Sources */}
          <div className="p-4 rounded-lg border border-blue-500 bg-blue-500/10">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              🎵 Sources (/cws/api/sources)
            </h2>
            <pre className="text-xs bg-black/20 p-3 rounded overflow-auto max-h-96 text-[var(--text-secondary)]">
              {JSON.stringify((results as Record<string, unknown>).sources, null, 2)}
            </pre>
          </div>

          {/* Media Rooms (for comparison) */}
          <div className="p-4 rounded-lg border border-purple-500 bg-purple-500/10">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              🔊 Media Rooms (/cws/api/mediarooms) - For Comparison
            </h2>
            <pre className="text-xs bg-black/20 p-3 rounded overflow-auto max-h-64 text-[var(--text-secondary)]">
              {JSON.stringify((results as Record<string, unknown>).mediaRooms, null, 2)}
            </pre>
          </div>

          {/* Other Probed Endpoints */}
          <div className="p-4 rounded-lg border border-gray-500 bg-gray-500/10">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Other Endpoints Probed
            </h2>
            <pre className="text-xs bg-black/20 p-3 rounded overflow-auto max-h-32 text-[var(--text-secondary)]">
              {JSON.stringify((results as Record<string, unknown>).probeResults, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

