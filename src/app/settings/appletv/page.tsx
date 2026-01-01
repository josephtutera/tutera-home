"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv,
  Search,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Wifi,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";

interface AppleTVDevice {
  id: string;
  name: string;
  address: string;
  model?: string;
  os_version?: string;
  is_connected: boolean;
}

type PairingStep = "idle" | "scanning" | "selecting" | "starting" | "awaiting_pin" | "finishing" | "success" | "error";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function AppleTVPairingPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const { isConnected } = useAuthStore();
  
  // State
  const [devices, setDevices] = useState<AppleTVDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<AppleTVDevice | null>(null);
  const [step, setStep] = useState<PairingStep>("idle");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isConnected) {
      router.push("/login");
    }
  }, [isConnected, router, isMounted]);

  // Scan for Apple TVs
  const scanForDevices = async () => {
    setStep("scanning");
    setError(null);
    setDevices([]);
    
    try {
      // First try to get cached devices
      const listResponse = await fetch("/api/appletv/devices");
      if (listResponse.ok) {
        const cachedDevices = await listResponse.json();
        if (cachedDevices.length > 0) {
          // Filter to likely Apple TVs (exclude Samsung TVs, Sonos, etc.)
          const appleTvs = cachedDevices.filter((d: AppleTVDevice) => 
            d.name.toLowerCase().includes("apple") || 
            d.id.includes(":") // Device IDs with colons are typically Apple TVs
          );
          setDevices(appleTvs.length > 0 ? appleTvs : cachedDevices);
        }
      }
      
      // Then do a fresh scan
      const scanResponse = await fetch("/api/appletv/devices/scan", {
        method: "POST",
      });
      
      if (!scanResponse.ok) {
        const errorData = await scanResponse.json();
        throw new Error(errorData.error || "Failed to scan for devices");
      }
      
      const scannedDevices = await scanResponse.json();
      // Filter to likely Apple TVs
      const appleTvs = scannedDevices.filter((d: AppleTVDevice) => 
        d.name.toLowerCase().includes("apple") || 
        d.id.includes(":")
      );
      setDevices(appleTvs.length > 0 ? appleTvs : scannedDevices);
      setStep("selecting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan for devices");
      setStep("error");
    }
  };

  // Start pairing with selected device
  const startPairing = async (device: AppleTVDevice) => {
    setSelectedDevice(device);
    setStep("starting");
    setError(null);
    setPin("");
    
    try {
      const response = await fetch(
        `/api/appletv/devices/${encodeURIComponent(device.id)}/pair/start?protocol=companion`,
        { method: "POST" }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.error || "Failed to start pairing");
      }
      
      setStep("awaiting_pin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start pairing");
      setStep("error");
    }
  };

  // Complete pairing with PIN
  const finishPairing = async () => {
    if (!selectedDevice || pin.length !== 4) return;
    
    setStep("finishing");
    setError(null);
    
    try {
      const response = await fetch(
        `/api/appletv/devices/${encodeURIComponent(selectedDevice.id)}/pair/finish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.error || "Pairing failed - check PIN");
      }
      
      setSuccessMessage(`Successfully paired with ${selectedDevice.name}!`);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed");
      setStep("error");
    }
  };

  // Reset to initial state
  const reset = () => {
    setStep("idle");
    setSelectedDevice(null);
    setPin("");
    setError(null);
    setSuccessMessage(null);
  };

  // PIN input handler - only allow digits
  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
  };

  // Wait for hydration
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Back Link */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-lg">
            <Tv className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Apple TV Pairing
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Connect your Apple TVs for remote control
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Initial State - Scan Button */}
          {step === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--accent)] to-blue-600 flex items-center justify-center">
                  <Search className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Find Apple TVs on Your Network
                </h2>
                <p className="text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                  Scan your local network to discover Apple TV devices available for pairing.
                </p>
                <button
                  onClick={scanForDevices}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/25"
                >
                  <Wifi className="w-5 h-5" />
                  Scan for Apple TVs
                </button>
              </Card>

              {/* Info Box */}
              <div className="p-4 bg-[var(--accent-lighter)] border border-[var(--accent)]/20 rounded-xl">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-[var(--text-primary)] mb-1">
                      Before you begin
                    </p>
                    <ul className="text-[var(--text-secondary)] space-y-1">
                      <li>• Make sure your Apple TV is powered on and awake</li>
                      <li>• Have visual access to the TV screen (for the PIN code)</li>
                      <li>• The pyatv service must be running on your Synology NAS</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Scanning State */}
          {step === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Scanning Network...
                </h2>
                <p className="text-[var(--text-secondary)]">
                  Looking for Apple TV devices on your network
                </p>
              </Card>
            </motion.div>
          )}

          {/* Device Selection */}
          {step === "selecting" && (
            <motion.div
              key="selecting"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Found {devices.length} Device{devices.length !== 1 ? "s" : ""}
                </h2>
                <button
                  onClick={scanForDevices}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rescan
                </button>
              </div>

              {devices.length === 0 ? (
                <Card className="p-8 text-center">
                  <XCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                  <p className="text-[var(--text-secondary)]">
                    No Apple TV devices found. Make sure they are powered on and on the same network.
                  </p>
                  <button
                    onClick={reset}
                    className="mt-4 text-sm text-[var(--accent)] hover:underline"
                  >
                    Try again
                  </button>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {devices.map((device) => (
                    <motion.div key={device.id} variants={itemVariants}>
                      <Card
                        hoverable
                        padding="none"
                        className="overflow-hidden"
                        onClick={() => startPairing(device)}
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center flex-shrink-0">
                            <Tv className="w-7 h-7 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[var(--text-primary)] truncate">
                              {device.name}
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)] truncate">
                              {device.address}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] font-mono truncate mt-0.5">
                              {device.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {device.is_connected && (
                              <span className="px-2 py-1 text-xs font-medium bg-[var(--success-light)] text-[var(--success)] rounded-full">
                                Connected
                              </span>
                            )}
                            <Link2 className="w-5 h-5 text-[var(--accent)]" />
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}

              <button
                onClick={reset}
                className="w-full mt-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* Starting Pairing */}
          {step === "starting" && (
            <motion.div
              key="starting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Initiating Pairing...
                </h2>
                <p className="text-[var(--text-secondary)]">
                  Connecting to {selectedDevice?.name}
                </p>
              </Card>
            </motion.div>
          )}

          {/* Awaiting PIN */}
          {step === "awaiting_pin" && (
            <motion.div
              key="awaiting_pin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="p-8">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Tv className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    Enter the PIN from Your TV
                  </h2>
                  <p className="text-[var(--text-secondary)]">
                    A 4-digit code should be displayed on <strong>{selectedDevice?.name}</strong>
                  </p>
                </div>

                {/* PIN Input */}
                <div className="flex justify-center gap-3 mb-8">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`
                        w-16 h-20 rounded-xl border-2 flex items-center justify-center
                        text-3xl font-bold transition-all
                        ${pin[index] 
                          ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--text-primary)]" 
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)]"
                        }
                      `}
                    >
                      {pin[index] || "•"}
                    </div>
                  ))}
                </div>

                {/* Hidden input for capturing PIN */}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  className="sr-only"
                  autoFocus
                />

                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((num, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (num === null) return;
                        if (num === "del") {
                          setPin((p) => p.slice(0, -1));
                        } else {
                          if (pin.length < 4) {
                            setPin((p) => p + num);
                          }
                        }
                      }}
                      disabled={num === null}
                      className={`
                        h-14 rounded-xl font-semibold text-xl transition-all
                        ${num === null 
                          ? "opacity-0 cursor-default" 
                          : num === "del"
                            ? "bg-[var(--danger-light)] text-[var(--danger)] hover:bg-[var(--danger)]/20"
                            : "bg-[var(--surface-hover)] text-[var(--text-primary)] hover:bg-[var(--surface-active)] active:scale-95"
                        }
                      `}
                    >
                      {num === "del" ? "⌫" : num}
                    </button>
                  ))}
                </div>

                {/* Submit Button */}
                <button
                  onClick={finishPairing}
                  disabled={pin.length !== 4}
                  className={`
                    w-full py-4 rounded-xl font-semibold text-lg transition-all
                    ${pin.length === 4
                      ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/25"
                      : "bg-[var(--border)] text-[var(--text-tertiary)] cursor-not-allowed"
                    }
                  `}
                >
                  Complete Pairing
                </button>
              </Card>

              <button
                onClick={reset}
                className="w-full py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* Finishing */}
          {step === "finishing" && (
            <motion.div
              key="finishing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Completing Pairing...
                </h2>
                <p className="text-[var(--text-secondary)]">
                  Verifying PIN and saving credentials
                </p>
              </Card>
            </motion.div>
          )}

          {/* Success */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--success)] flex items-center justify-center"
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Pairing Successful!
                </h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  {successMessage}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      reset();
                      scanForDevices();
                    }}
                    className="px-5 py-2.5 bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium rounded-xl hover:bg-[var(--surface-active)] transition-colors"
                  >
                    Pair Another
                  </button>
                  <Link
                    href="/media"
                    className="px-5 py-2.5 bg-[var(--accent)] text-white font-medium rounded-xl hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    Go to Media
                  </Link>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Error */}
          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--danger-light)] flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-[var(--danger)]" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Something Went Wrong
                </h2>
                <p className="text-[var(--text-secondary)] mb-2">
                  {error}
                </p>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Make sure the Apple TV is awake and try again.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={reset}
                    className="px-5 py-2.5 bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium rounded-xl hover:bg-[var(--surface-active)] transition-colors"
                  >
                    Start Over
                  </button>
                  {selectedDevice && (
                    <button
                      onClick={() => startPairing(selectedDevice)}
                      className="px-5 py-2.5 bg-[var(--accent)] text-white font-medium rounded-xl hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Card padding="sm" className="bg-[var(--surface)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
              Troubleshooting Tips
            </h3>
            <ul className="text-xs text-[var(--text-secondary)] space-y-1">
              <li>• If no PIN appears, wake the Apple TV with its physical remote first</li>
              <li>• Pairing uses the Companion protocol for full remote control support</li>
              <li>• Each Apple TV needs to be paired separately</li>
              <li>• If pairing fails, try restarting the pyatv service on your Synology NAS</li>
            </ul>
          </Card>
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}
