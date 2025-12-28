"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Layers, Plus, Trash2, Edit2, Check, X, ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNavigation } from "@/components/layout/Navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshedAt } from "@/components/ui/RefreshedAt";
import type { Room, MergedRoom } from "@/lib/crestron/types";
import {
  useDeviceStore,
  fetchAllData,
  createMergedRoom,
  updateMergedRoom,
  deleteMergedRoom,
} from "@/stores/deviceStore";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type Mode = "list" | "create" | "edit";

export default function MergeRoomsPage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  const { rooms, mergedRooms, isLoading } = useDeviceStore();
  
  const [mode, setMode] = useState<Mode>("list");
  const [editingRoom, setEditingRoom] = useState<MergedRoom | null>(null);
  const [name, setName] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      router.push("/login");
    }
  }, [isConnected, router]);

  // Populate form when editing
  useEffect(() => {
    if (editingRoom) {
      setName(editingRoom.name);
      setSelectedRoomIds(editingRoom.sourceRoomIds);
    }
  }, [editingRoom]);

  const handleToggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
    setError(null);
  };

  const handleCreate = () => {
    setMode("create");
    setName("");
    setSelectedRoomIds([]);
    setError(null);
  };

  const handleEdit = (mergedRoom: MergedRoom) => {
    setMode("edit");
    setEditingRoom(mergedRoom);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to unmerge this room? The merged room will be removed, but the original rooms will remain.")) return;
    
    setIsSaving(true);
    const success = await deleteMergedRoom(id);
    setIsSaving(false);
    
    if (!success) {
      setError("Failed to unmerge room");
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError("Please enter a name for the merged room");
      return;
    }
    if (selectedRoomIds.length < 2) {
      setError("Please select at least 2 rooms to merge");
      return;
    }

    setIsSaving(true);
    setError(null);

    if (mode === "create") {
      const result = await createMergedRoom(name.trim(), selectedRoomIds);
      if (result) {
        setMode("list");
        setName("");
        setSelectedRoomIds([]);
      } else {
        setError("Failed to create merged room");
      }
    } else if (mode === "edit" && editingRoom) {
      const result = await updateMergedRoom(
        editingRoom.id,
        name.trim(),
        selectedRoomIds
      );
      if (result) {
        setMode("list");
        setEditingRoom(null);
        setName("");
        setSelectedRoomIds([]);
      } else {
        setError("Failed to update merged room");
      }
    }

    setIsSaving(false);
  };

  const handleCancel = () => {
    setMode("list");
    setEditingRoom(null);
    setName("");
    setSelectedRoomIds([]);
    setError(null);
  };

  // Get room name by ID
  const getRoomName = (id: string) => rooms.find((r) => r.id === id)?.name || id;

  // Get available rooms (exclude rooms already in other merged rooms)
  const getAvailableRooms = () => {
    const usedRoomIds = new Set<string>();
    mergedRooms.forEach(mr => {
      if (mode === "edit" && editingRoom && mr.id === editingRoom.id) {
        // When editing, allow rooms from the current merged room
        return;
      }
      mr.sourceRoomIds.forEach(rid => usedRoomIds.add(rid));
    });
    
    return rooms.filter(r => !usedRoomIds.has(r.id));
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-6">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Room Merge
              </h1>
              <RefreshedAt />
            </div>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {mode === "list" ? (
            <motion.div variants={itemVariants}>
              {/* Description */}
              <Card padding="md" className="mb-6 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
                <p className="text-sm text-[var(--text-secondary)]">
                  Merge multiple Crestron rooms into a single view. For example, merge "Side Porch" and "Front Porch" 
                  into a merged room called "Porch". All devices from both rooms will be displayed together.
                </p>
              </Card>

              {/* List of existing merged rooms */}
              <div className="space-y-3">
                {mergedRooms.length === 0 ? (
                  <Card padding="lg" className="text-center py-12">
                    <div className="w-16 h-16 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center mx-auto mb-4">
                      <Layers className="w-8 h-8 text-[var(--text-tertiary)]" />
                    </div>
                    <p className="text-lg font-medium text-[var(--text-primary)] mb-2">
                      No merged rooms yet
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                      Create a merged room to combine multiple rooms into one view
                    </p>
                    <Button
                      variant="primary"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={handleCreate}
                    >
                      Create Merged Room
                    </Button>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        Merged Rooms ({mergedRooms.length})
                      </h2>
                      <Button
                        variant="primary"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={handleCreate}
                      >
                        Create Merged Room
                      </Button>
                    </div>
                    {mergedRooms.map((mergedRoom) => (
                      <motion.div key={mergedRoom.id} variants={itemVariants}>
                        <Card padding="md" className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                              <Layers className="w-6 h-6 text-purple-500" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-[var(--text-primary)] mb-1">
                                {mergedRoom.name}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)]">
                                {mergedRoom.sourceRoomIds
                                  .map(getRoomName)
                                  .join(" + ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/rooms/${mergedRoom.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                            <button
                              onClick={() => handleEdit(mergedRoom)}
                              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                            <button
                              onClick={() => handleDelete(mergedRoom.id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                              title="Unmerge"
                              disabled={isSaving}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div variants={itemVariants}>
              <Card padding="lg">
                <div className="space-y-6">
                  {/* Header */}
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                      {mode === "create" ? "Create Merged Room" : "Edit Merged Room"}
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Select rooms to merge and give the merged room a name
                    </p>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Merged Room Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError(null);
                      }}
                      placeholder="e.g., Porch, Office, Living Space"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)]
                        bg-[var(--background)] text-[var(--text-primary)]
                        placeholder:text-[var(--text-tertiary)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                        transition-all duration-200"
                      autoFocus
                    />
                  </div>

                  {/* Room Selection */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Select Rooms to Merge ({selectedRoomIds.length} selected)
                    </label>
                    {mode === "edit" && editingRoom && (
                      <p className="text-xs text-[var(--text-tertiary)] mb-3">
                        Currently merged: {editingRoom.sourceRoomIds.map(getRoomName).join(", ")}
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1">
                      {(mode === "edit" && editingRoom 
                        ? rooms.filter(r => editingRoom.sourceRoomIds.includes(r.id) || !mergedRooms.some(mr => mr.id !== editingRoom.id && mr.sourceRoomIds.includes(r.id)))
                        : getAvailableRooms()
                      ).map((room) => {
                        const isSelected = selectedRoomIds.includes(room.id);
                        const isInOtherMerged = mode === "create" && mergedRooms.some(mr => mr.sourceRoomIds.includes(room.id));
                        
                        return (
                          <button
                            key={room.id}
                            onClick={() => !isInOtherMerged && handleToggleRoom(room.id)}
                            disabled={isInOtherMerged}
                            className={`
                              relative px-3 py-2.5 rounded-xl text-sm font-medium text-left
                              transition-all duration-200 border-2
                              ${isInOtherMerged
                                ? "bg-[var(--surface)] border-[var(--border)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed"
                                : isSelected
                                  ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]"
                                  : "bg-[var(--surface)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                              }
                            `}
                            title={isInOtherMerged ? "This room is already in another merged room" : ""}
                          >
                            <span className="block truncate pr-5">{room.name}</span>
                            {isSelected && (
                              <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {getAvailableRooms().length === 0 && mode === "create" && (
                      <p className="text-sm text-[var(--text-tertiary)] mt-2">
                        All rooms are already in merged rooms. Edit or delete existing merged rooms to free up rooms.
                      </p>
                    )}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg">
                      <X className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-light)]">
                    <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      loading={isSaving}
                      leftIcon={mode === "create" ? <Plus className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    >
                      {mode === "create" ? "Create Merged Room" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}

