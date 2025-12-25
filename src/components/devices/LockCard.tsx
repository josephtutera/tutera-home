"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import type { DoorLock } from "@/lib/crestron/types";
import { setDoorLockState } from "@/stores/deviceStore";

interface LockCardProps {
  lock: DoorLock;
  compact?: boolean;
}

export function LockCard({ lock, compact = false }: LockCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const isLocked = lock.isLocked;

  const handleToggle = useCallback(async (checked: boolean) => {
    setIsUpdating(true);
    await setDoorLockState(lock.id, checked);
    setIsUpdating(false);
  }, [lock.id]);

  if (compact) {
    return (
      <Card
        hoverable
        padding="sm"
        className={`
          transition-all duration-300
          ${isLocked 
            ? "bg-[var(--success)]/10 border-[var(--success)]/30" 
            : "bg-[var(--danger)]/10 border-[var(--danger)]/30"
          }
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              animate={{
                backgroundColor: isLocked ? "var(--success)" : "var(--danger)",
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              {isLocked ? (
                <Lock className="w-5 h-5 text-white" />
              ) : (
                <Unlock className="w-5 h-5 text-white" />
              )}
            </motion.div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {lock.name}
              </p>
              <p 
                className="text-xs font-medium"
                style={{ color: isLocked ? "var(--success)" : "var(--danger)" }}
              >
                {isLocked ? "Locked" : "Unlocked"}
              </p>
            </div>
          </div>
          <Toggle
            checked={isLocked}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
            size="sm"
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      padding="md"
      className={`
        transition-all duration-300
        ${isLocked 
          ? "bg-[var(--success)]/10 border-[var(--success)]/30" 
          : "bg-[var(--danger)]/10 border-[var(--danger)]/30"
        }
      `}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              backgroundColor: isLocked ? "var(--success)" : "var(--danger)",
              scale: isLocked ? 1 : 1.05,
            }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center"
          >
            {isLocked ? (
              <Lock className="w-6 h-6 text-white" />
            ) : (
              <Unlock className="w-6 h-6 text-white" />
            )}
          </motion.div>
          <div>
            <CardTitle>{lock.name}</CardTitle>
            <p 
              className="text-sm font-medium"
              style={{ color: isLocked ? "var(--success)" : "var(--danger)" }}
            >
              {isLocked ? "Secured" : "Unsecured"}
            </p>
          </div>
        </div>
      </CardHeader>

      {/* Large toggle button */}
      <div className="mt-4">
        <button
          onClick={() => handleToggle(!isLocked)}
          disabled={isUpdating}
          className={`
            w-full py-4 rounded-xl font-medium text-white
            transition-all duration-300
            flex items-center justify-center gap-2
            ${isLocked 
              ? "bg-[var(--danger)] hover:bg-[var(--danger)]/90" 
              : "bg-[var(--success)] hover:bg-[var(--success)]/90"
            }
            ${isUpdating ? "opacity-70" : ""}
          `}
        >
          {isUpdating ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isLocked ? (
            <>
              <Unlock className="w-5 h-5" />
              Unlock
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              Lock
            </>
          )}
        </button>
      </div>

      {/* Status indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        {isLocked ? (
          <>
            <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
            <span className="text-[var(--success)]">Door is secure</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
            <span className="text-[var(--danger)]">Door is unlocked</span>
          </>
        )}
      </div>
    </Card>
  );
}

// Lock all button component
interface LockAllButtonProps {
  locks: DoorLock[];
}

export function LockAllButton({ locks }: LockAllButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const allLocked = locks.every(l => l.isLocked);
  const unlockedCount = locks.filter(l => !l.isLocked).length;

  const handleLockAll = async () => {
    setIsUpdating(true);
    for (const lock of locks) {
      if (!lock.isLocked) {
        await setDoorLockState(lock.id, true);
      }
    }
    setIsUpdating(false);
  };

  return (
    <button
      onClick={handleLockAll}
      disabled={isUpdating || allLocked}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-xl font-medium
        transition-all duration-200
        ${allLocked
          ? "bg-[var(--success)]/20 text-[var(--success)] cursor-default"
          : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
        }
      `}
    >
      {isUpdating ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Lock className="w-4 h-4" />
      )}
      {allLocked ? "All Locked" : `Lock All (${unlockedCount})`}
    </button>
  );
}

export default LockCard;

