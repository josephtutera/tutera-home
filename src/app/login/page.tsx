"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Wifi, Key, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuthStore, login } from "@/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { isConnecting, error } = useAuthStore();
  
  const [processorIp, setProcessorIp] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!processorIp.trim()) {
      setLocalError("Please enter the processor IP address");
      return;
    }

    // authToken is now optional - will use ENV variable if not provided
    const success = await login(processorIp.trim(), authToken.trim() || "");
    if (success) {
      router.push("/");
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)] mb-4"
          >
            <Home className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Crestron Home
          </h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Connect to your smart home system
          </p>
        </div>

        {/* Login Card */}
        <Card padding="lg" className="shadow-[var(--shadow-lg)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Processor IP */}
            <div>
              <label
                htmlFor="processorIp"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                Processor IP Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Wifi className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
                <input
                  id="processorIp"
                  type="text"
                  value={processorIp}
                  onChange={(e) => setProcessorIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="
                    w-full pl-10 pr-4 py-3
                    bg-[var(--surface)] border border-[var(--border)]
                    rounded-[var(--radius)] text-[var(--text-primary)]
                    placeholder:text-[var(--text-tertiary)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                    transition-all duration-200
                  "
                  disabled={isConnecting}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                The local IP address of your Crestron Home processor
              </p>
            </div>

            {/* Auth Token */}
            <div>
              <label
                htmlFor="authToken"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                Authorization Token <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
                <input
                  id="authToken"
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Uses CRESTON_HOME_KEY env if empty"
                  className="
                    w-full pl-10 pr-4 py-3
                    bg-[var(--surface)] border border-[var(--border)]
                    rounded-[var(--radius)] text-[var(--text-primary)]
                    placeholder:text-[var(--text-tertiary)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                    transition-all duration-200
                  "
                  disabled={isConnecting}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                Leave empty to use CRESTON_HOME_KEY from environment
              </p>
            </div>

            {/* Error Message */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 p-3 bg-[var(--danger-light)] text-[var(--danger)] rounded-[var(--radius-sm)] text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{displayError}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </form>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-[var(--text-tertiary)] mt-6">
          Make sure you&apos;re on the same network as your Crestron processor
        </p>
      </motion.div>
    </div>
  );
}

