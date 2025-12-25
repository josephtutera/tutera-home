"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Palette, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { SceneCard } from "@/components/devices/SceneCard";
import { useAuthStore } from "@/stores/authStore";
import { useDeviceStore, fetchScenes } from "@/stores/deviceStore";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function ScenesPage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  const { scenes, isLoading } = useDeviceStore();

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (isConnected) {
      fetchScenes();
    }
  }, [isConnected]);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Scenes
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {scenes.length} available scenes
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchScenes()}
            disabled={isLoading}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-secondary)] ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Scenes Grid */}
        {scenes.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {scenes.map((scene) => (
              <motion.div key={scene.id} variants={itemVariants}>
                <SceneCard scene={scene} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <Palette className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              No Scenes Found
            </h3>
            <p className="text-[var(--text-secondary)]">
              Scenes configured in your Crestron system will appear here.
            </p>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}

