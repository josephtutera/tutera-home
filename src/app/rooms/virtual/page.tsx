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
import type { Room, VirtualRoom } from "@/lib/crestron/types";
import {
  useDeviceStore,
  fetchAllData,
  createVirtualRoom,
  updateVirtualRoom,
  deleteVirtualRoom,
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

export default function VirtualRoomsPage() {
  const router = useRouter();
  const { isConnected } = useAuthStore();
  const { rooms, virtualRooms, areas, isLoading } = useDeviceStore();
  
  const [mode, setMode] = useState<Mode>("list");
  const [editingRoom, setEditingRoom] = useState<VirtualRoom | null>(null);
  const [name, setName] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
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
      setSelectedAreaId(editingRoom.areaId || "");
    }
  }, [editingRoom]);

  // Auto-select area from first source room when rooms are selected
  useEffect(() => {
    if (selectedRoomIds.length > 0 && !selectedAreaId) {
      for (const roomId of selectedRoomIds) {
        const room = rooms.find(r => r.id === roomId);
        if (room?.areaId && room?.areaName) {
          setSelectedAreaId(room.areaId);
          break;
        }
      }
    }
  }, [selectedRoomIds, rooms, selectedAreaId]);

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
    setSelectedAreaId("");
    setError(null);
  };

  const handleEdit = (virtualRoom: VirtualRoom) => {
    setMode("edit");
    setEditingRoom(virtualRoom);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this virtual room? The virtual room will be removed, but the original rooms will remain.")) return;
    
    setIsSaving(true);
    const success = await deleteVirtualRoom(id);
    setIsSaving(false);
    
    if (!success) {
      setError("Failed to remove virtual room");
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError("Please enter a name for the virtual room");
      return;
    }
    if (selectedRoomIds.length < 2) {
      setError("Please select at least 2 rooms to combine");
      return;
    }

    // Try to get area from first source room
    let areaId: string | undefined;
    let areaName: string | undefined;
    
    for (const roomId of selectedRoomIds) {
      const room = rooms.find(r => r.id === roomId);
      if (room?.areaId && room?.areaName) {
        areaId = room.areaId;
        areaName = room.areaName;
        break;
      }
    }
    
    // If no area found from rooms, use selected area
    if (!areaId || !areaName) {
      if (selectedAreaId) {
        const area = areas.find(a => a.id === selectedAreaId);
        if (area) {
          areaId = area.id;
          areaName = area.name;
        }
      }
    }
    
    // If still no area, show error
    if (!areaId || !areaName) {
      setError("Please select an area for this virtual room");
      return;
    }

    setIsSaving(true);
    setError(null);

    if (mode === "create") {
      const result = await createVirtualRoom(name.trim(), selectedRoomIds, areaId, areaName);
      if (result) {
        setMode("list");
        setName("");
        setSelectedRoomIds([]);
        setSelectedAreaId("");
      } else {
        setError("Failed to create virtual room. Please ensure an area is selected.");
      }
    } else if (mode === "edit" && editingRoom) {
      const result = await updateVirtualRoom(
        editingRoom.id,
        name.trim(),
        selectedRoomIds,
        areaId,
        areaName
      );
      if (result) {
        setMode("list");
        setEditingRoom(null);
        setName("");
        setSelectedRoomIds([]);
        setSelectedAreaId("");
      } else {
        setError("Failed to update virtual room");
      }
    }

    setIsSaving(false);
  };

  const handleCancel = () => {
    setMode("list");
    setEditingRoom(null);
    setName("");
    setSelectedRoomIds([]);
    setSelectedAreaId("");
    setError(null);
  };

  // Get room name by ID
  const getRoomName = (id: string) => rooms.find((r) => r.id === id)?.name || id;

  // Get available rooms (exclude rooms already in other virtual rooms)
  const getAvailableRooms = () => {
    const usedRoomIds = new Set<string>();
    virtualRooms.forEach(vr => {
      if (mode === "edit" && editingRoom && vr.id === editingRoom.id) {
        // When editing, allow rooms from the current virtual room
        return;
      }
      vr.sourceRoomIds.forEach(rid => usedRoomIds.add(rid));
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
                Virtual Rooms
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
                  Combine multiple Crestron rooms into a single virtual room. For example, combine "Side Porch" and "Front Porch" 
                  into a virtual room called "Porch". All devices from both rooms will be displayed together.
                </p>
              </Card>

              {/* List of existing virtual rooms */}
              <div className="space-y-3">
                {virtualRooms.length === 0 ? (
                  <Card padding="lg" className="text-center py-12">
                    <div className="w-16 h-16 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center mx-auto mb-4">
                      <Layers className="w-8 h-8 text-[var(--text-tertiary)]" />
                    </div>
                    <p className="text-lg font-medium text-[var(--text-primary)] mb-2">
                      No virtual rooms yet
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                      Create a virtual room to combine multiple rooms into one view
                    </p>
                    <Button
                      variant="primary"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={handleCreate}
                    >
                      Create Virtual Room
                    </Button>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        Virtual Rooms ({virtualRooms.length})
                      </h2>
                      <Button
                        variant="primary"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={handleCreate}
                      >
                        Create Virtual Room
                      </Button>
                    </div>
                    {virtualRooms.map((virtualRoom) => (
                      <motion.div key={virtualRoom.id} variants={itemVariants}>
                        <Card padding="md" className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                              <Layers className="w-6 h-6 text-purple-500" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-[var(--text-primary)] mb-1">
                                {virtualRoom.name}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)]">
                                {virtualRoom.sourceRoomIds
                                  .map(getRoomName)
                                  .join(" + ")}
                                {virtualRoom.areaName && (
                                  <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                                    • {virtualRoom.areaName}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/rooms/${virtualRoom.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                            <button
                              onClick={() => handleEdit(virtualRoom)}
                              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                            <button
                              onClick={() => handleDelete(virtualRoom.id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                              title="Remove Virtual Room"
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
                      {mode === "create" ? "Create Virtual Room" : "Edit Virtual Room"}
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Select rooms to combine and give the virtual room a name
                    </p>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Virtual Room Name
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
                      Select Rooms to Combine ({selectedRoomIds.length} selected)
                    </label>
                    {mode === "edit" && editingRoom && (
                      <p className="text-xs text-[var(--text-tertiary)] mb-3">
                        Currently combined: {editingRoom.sourceRoomIds.map(getRoomName).join(", ")}
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1">
                      {(mode === "edit" && editingRoom 
                        ? rooms.filter(r => editingRoom.sourceRoomIds.includes(r.id) || !virtualRooms.some(vr => vr.id !== editingRoom.id && vr.sourceRoomIds.includes(r.id)))
                        : getAvailableRooms()
                      ).map((room) => {
                        const isSelected = selectedRoomIds.includes(room.id);
                        const isInOtherVirtual = mode === "create" && virtualRooms.some(vr => vr.sourceRoomIds.includes(room.id));
                        
                        return (
                          <button
                            key={room.id}
                            onClick={() => !isInOtherVirtual && handleToggleRoom(room.id)}
                            disabled={isInOtherVirtual}
                            className={`
                              relative px-3 py-2.5 rounded-xl text-sm font-medium text-left
                              transition-all duration-200 border-2
                              ${isInOtherVirtual
                                ? "bg-[var(--surface)] border-[var(--border)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed"
                                : isSelected
                                  ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]"
                                  : "bg-[var(--surface)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                              }
                            `}
                            title={isInOtherVirtual ? "This room is already in another virtual room" : ""}
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
                        All rooms are already in virtual rooms. Edit or delete existing virtual rooms to free up rooms.
                      </p>
                    )}
                  </div>

                  {/* Area Selection */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Area {!selectedAreaId && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={selectedAreaId}
                      onChange={(e) => {
                        setSelectedAreaId(e.target.value);
                        setError(null);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)]
                        bg-[var(--background)] text-[var(--text-primary)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                        transition-all duration-200"
                    >
                      <option value="">Select an area...</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                    {selectedRoomIds.length > 0 && !selectedAreaId && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Area will be auto-selected from first source room if available
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
                      {mode === "create" ? "Create Virtual Room" : "Save Changes"}
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

