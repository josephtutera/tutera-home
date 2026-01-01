"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, X } from "lucide-react";
import { AICommandModal } from "./AICommandModal";
import { useAuthStore } from "@/stores/authStore";

/**
 * Floating Action Button for AI-powered voice/text control
 * Appears globally when user is authenticated
 */
export function AICommandButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { isConnected } = useAuthStore();

  // Handle keyboard shortcut (Ctrl/Cmd + J to open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Don't render if not connected
  if (!isConnected) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isModalOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={() => setIsModalOpen(true)}
            className="fixed bottom-24 md:bottom-8 right-20 md:right-24 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#6366f1] text-white shadow-lg shadow-[var(--accent)]/30 flex items-center justify-center group"
            style={{
              boxShadow: isHovered
                ? "0 8px 30px rgba(99, 102, 241, 0.4)"
                : "0 4px 20px rgba(99, 102, 241, 0.3)",
            }}
          >
            {/* Animated rings */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/30"
              animate={{
                scale: [1, 1.3, 1.3],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/20"
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.3, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.3,
              }}
            />
            
            {/* Icon */}
            <motion.div
              animate={isHovered ? { rotate: [0, -10, 10, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && !isModalOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="fixed bottom-[7.5rem] md:bottom-10 right-36 md:right-40 z-40 bg-[var(--surface)] text-[var(--text-primary)] px-3 py-2 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap border border-[var(--border-light)]"
          >
            <div className="flex items-center gap-2">
              <span>AI Control</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-[var(--surface-hover)] rounded border border-[var(--border-light)]">
                ⌘J
              </kbd>
            </div>
            {/* Arrow */}
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[6px] border-transparent border-l-[var(--surface)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Modal */}
      <AICommandModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
