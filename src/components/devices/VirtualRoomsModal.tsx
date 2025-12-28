"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Room, VirtualRoom, Area } from "@/lib/crestron/types";
import {
  createVirtualRoom,
  updateVirtualRoom,
  deleteVirtualRoom,
  useDeviceStore,
} from "@/stores/deviceStore";

interface VirtualRoomsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  virtualRooms: VirtualRoom[];
}

export function VirtualRoomsModal({
  open,
  onOpenChange,
  rooms,
  virtualRooms,
}: VirtualRoomsModalProps) {
  const { areas } = useDeviceStore();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingRoom, setEditingRoom] = useState<VirtualRoom | null>(null);
  const [name, setName] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingRoom(null);
      setName("");
      setSelectedRoomIds([]);
      setSelectedAreaId("");
      setError(null);
    }
  }, [open]);

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
    if (!confirm("Are you sure you want to delete this virtual room?")) return;
    
    setIsLoading(true);
    const success = await deleteVirtualRoom(id);
    setIsLoading(false);
    
    if (!success) {
      setError("Failed to delete virtual room");
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

    setIsLoading(true);
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

    setIsLoading(false);
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

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "list"
          ? "Virtual Rooms"
          : mode === "create"
          ? "Create Virtual Room"
          : "Edit Virtual Room"
      }
      description={
        mode === "list"
          ? "Combine multiple rooms into one view"
          : "Select rooms to combine and give it a name"
      }
      size="lg"
    >
      <AnimatePresence mode="wait">
        {mode === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* List of existing virtual rooms */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {virtualRooms.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-6 h-6 text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-[var(--text-secondary)] mb-1">
                    No virtual rooms yet
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Create one to combine multiple rooms
                  </p>
                </div>
              ) : (
                virtualRooms.map((virtualRoom) => (
                  <Card
                    key={virtualRoom.id}
                    padding="md"
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">
                          {virtualRoom.name}
                        </p>
                        <p className="text-sm text-[var(--text-tertiary)]">
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
                    <div className="flex items-center gap-1">
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
                        title="Delete"
                        disabled={isLoading}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleCreate}
              >
                Create Virtual Room
              </Button>
            </ModalFooter>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Create/Edit Form */}
            <div className="space-y-4">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g., Office + Hearth"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)]
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto p-1">
                  {rooms.map((room) => {
                    const isSelected = selectedRoomIds.includes(room.id);
                    return (
                      <button
                        key={room.id}
                        onClick={() => handleToggleRoom(room.id)}
                        className={`
                          relative px-3 py-2.5 rounded-xl text-sm font-medium text-left
                          transition-all duration-200 border-2
                          ${
                            isSelected
                              ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]"
                              : "bg-[var(--surface)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          }
                        `}
                      >
                        <span className="block truncate pr-5">{room.name}</span>
                        {isSelected && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" />
                        )}
                      </button>
                    );
                  })}
                </div>
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
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)]
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
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                  <X className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <ModalFooter>
              <Button variant="ghost" onClick={handleCancel} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={isLoading}
                leftIcon={mode === "create" ? <Plus className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              >
                {mode === "create" ? "Create" : "Save Changes"}
              </Button>
            </ModalFooter>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

export default VirtualRoomsModal;

