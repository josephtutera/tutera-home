"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Blinds, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import type { Shade } from "@/lib/crestron/types";

interface ShadeCardProps {
  shade: Shade;
  compact?: boolean;
  onPositionChange?: (id: string, position: number) => Promise<void>;
}

export function ShadeCard({ shade, compact = false, onPositionChange }: ShadeCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const position = shade.position; // 0-100 (0 = closed, 100 = open)
  const isOpen = position > 0;

  const handlePositionChange = useCallback(async (values: number[]) => {
    if (onPositionChange) {
      setIsUpdating(true);
      await onPositionChange(shade.id, values[0]);
      setIsUpdating(false);
    }
  }, [shade.id, onPositionChange]);

  const handlePreset = useCallback(async (newPosition: number) => {
    if (onPositionChange) {
      setIsUpdating(true);
      await onPositionChange(shade.id, newPosition);
      setIsUpdating(false);
    }
  }, [shade.id, onPositionChange]);

  if (compact) {
    return (
      <Card
        hoverable
        padding="sm"
        className={`
          transition-all duration-300
          ${isOpen ? "bg-[var(--shade-color)]/10 border-[var(--shade-color)]/30" : ""}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                transition-all duration-300
                ${isOpen ? "bg-[var(--shade-color)] text-white" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"}
              `}
            >
              <Blinds className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {shade.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {position === 0 ? "Closed" : position === 100 ? "Open" : `${position}%`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePreset(100)}
              disabled={isUpdating || position === 100}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePreset(0)}
              disabled={isUpdating || position === 0}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      padding="md"
      className={`
        transition-all duration-300
        ${isOpen ? "bg-[var(--shade-color)]/10 border-[var(--shade-color)]/30" : ""}
      `}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              backgroundColor: isOpen ? "var(--shade-color)" : "var(--surface-hover)",
            }}
            className="w-12 h-12 rounded-xl flex items-center justify-center"
          >
            <Blinds className={`w-6 h-6 ${isOpen ? "text-white" : "text-[var(--text-tertiary)]"}`} />
          </motion.div>
          <div>
            <CardTitle>{shade.name}</CardTitle>
            <p className="text-sm text-[var(--text-secondary)]">
              {position === 0 ? "Closed" : position === 100 ? "Fully Open" : `${position}% Open`}
            </p>
          </div>
        </div>
      </CardHeader>

      {/* Visual shade representation */}
      <div className="mt-4 flex items-center gap-4">
        <div className="w-16 h-24 bg-[var(--border)] rounded-lg relative overflow-hidden">
          {/* Window frame */}
          <div className="absolute inset-1 bg-[var(--accent-lighter)] rounded">
            {/* Shade covering */}
            <motion.div
              className="absolute top-0 left-0 right-0 bg-[var(--shade-color)]/80 rounded-t"
              animate={{ height: `${100 - position}%` }}
              transition={{ duration: 0.3 }}
            >
              {/* Shade slats */}
              {[...Array(Math.max(1, Math.floor((100 - position) / 15)))].map((_, i) => (
                <div
                  key={i}
                  className="w-full h-2 border-b border-[var(--shade-color)]"
                />
              ))}
            </motion.div>
          </div>
        </div>

        <div className="flex-1">
          <Slider
            value={[position]}
            onValueCommit={handlePositionChange}
            min={0}
            max={100}
            step={5}
            disabled={isUpdating}
            showValue
            formatValue={(v) => `${v}%`}
            color="accent"
          />
        </div>
      </div>

      {/* Preset buttons */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => handlePreset(0)}
          disabled={isUpdating || position === 0}
          className={`
            flex-1 py-2 rounded-lg text-sm font-medium
            transition-all duration-200
            ${position === 0
              ? "bg-[var(--shade-color)] text-white"
              : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)]"
            }
          `}
        >
          <ChevronDown className="w-4 h-4 inline mr-1" />
          Close
        </button>
        <button
          onClick={() => handlePreset(50)}
          disabled={isUpdating}
          className={`
            flex-1 py-2 rounded-lg text-sm font-medium
            transition-all duration-200
            ${position === 50
              ? "bg-[var(--shade-color)] text-white"
              : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)]"
            }
          `}
        >
          <Minus className="w-4 h-4 inline mr-1" />
          50%
        </button>
        <button
          onClick={() => handlePreset(100)}
          disabled={isUpdating || position === 100}
          className={`
            flex-1 py-2 rounded-lg text-sm font-medium
            transition-all duration-200
            ${position === 100
              ? "bg-[var(--shade-color)] text-white"
              : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)]"
            }
          `}
        >
          <ChevronUp className="w-4 h-4 inline mr-1" />
          Open
        </button>
      </div>
    </Card>
  );
}

export default ShadeCard;

