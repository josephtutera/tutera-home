"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, Reorder, useDragControls } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home,
  Thermometer,
  Shield,
  Palette,
  Lightbulb,
  Blinds,
  Layers,
  GripVertical,
  MoveVertical,
  Plus,
  X,
  Check,
} from "lucide-react";
import type { MergedRoom, Area } from "@/lib/crestron/types";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/climate", label: "Climate", icon: Thermometer },
  { href: "/lighting", label: "Lighting", icon: Lightbulb },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/scenes", label: "Scenes", icon: Palette },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-[var(--border-light)] md:hidden safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                w-16 h-14 rounded-xl
                transition-colors duration-200
                ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-tertiary)]"
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeBottomNav"
                  className="absolute inset-0 bg-[var(--accent-lighter)] rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative">
                <item.icon className="w-5 h-5" />
              </span>
              <span className="relative text-[10px] font-medium mt-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Room tabs for filtering devices
interface RoomTab {
  id: string;
  name: string;
}

interface RoomTabsProps {
  rooms: RoomTab[];
  mergedRooms?: MergedRoom[];
  areas?: Area[];
  activeRoom: string | null;
  onRoomChange: (roomId: string | null) => void;
  onManageMergedRooms?: () => void;
  onMoveRoomToArea?: (roomId: string, roomName: string, sourceAreaId: string | null, targetAreaId: string) => void;
  onCreateArea?: (name: string) => Promise<boolean>;
  roomOrder?: string[];
  onRoomOrderChange?: (newOrder: string[]) => void;
}

// Local storage key for room order
const ROOM_ORDER_KEY = 'tutera-room-order';

// Draggable room button component (within-area reordering + cross-area move)
function DraggableRoomButton({ 
  room, 
  isActive, 
  onClick,
  areaId,
  onDragStart,
}: { 
  room: RoomTab; 
  isActive: boolean; 
  onClick: () => void;
  areaId: string | null;
  onDragStart: (roomId: string, roomName: string, areaId: string | null) => void;
}) {
  const dragControls = useDragControls();
  const moveHandleRef = useRef<HTMLDivElement>(null);

  // Handle cross-area drag start (from move handle only)
  const handleMoveHandleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({
      roomId: room.id,
      roomName: room.name,
      sourceAreaId: areaId,
    }));
    e.dataTransfer.effectAllowed = "move";
    onDragStart(room.id, room.name, areaId);
  };

  return (
    <Reorder.Item
      value={room.id}
      dragListener={false}
      dragControls={dragControls}
      className="shrink-0"
      whileDrag={{ scale: 1.05, zIndex: 50 }}
    >
      <div
        className={`
          flex items-center gap-1 px-2 py-2 rounded-[var(--radius-full)] text-sm font-medium
          transition-all duration-200 cursor-pointer select-none group
          ${
            isActive
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          }
        `}
      >
        {/* Grip handle for within-area reordering (framer-motion) */}
        <GripVertical 
          className="w-3 h-3 opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragControls.start(e);
          }}
        />
        <span onClick={onClick} className="px-1">{room.name}</span>
        {/* Move handle for cross-area dragging (HTML5 drag) */}
        <div
          ref={moveHandleRef}
          draggable
          onDragStart={handleMoveHandleDragStart}
          className="opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-move shrink-0 transition-opacity"
          title="Drag to move to another area"
        >
          <MoveVertical className="w-3 h-3" />
        </div>
      </div>
    </Reorder.Item>
  );
}

// Area drop zone component
function AreaDropZone({
  areaId,
  areaName,
  children,
  isDragging,
  onDrop,
}: {
  areaId: string;
  areaName: string;
  children: React.ReactNode;
  isDragging: boolean;
  onDrop: (targetAreaId: string, data: { roomId: string; roomName: string; sourceAreaId: string | null }) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.sourceAreaId !== areaId) {
        onDrop(areaId, data);
      }
    } catch {
      // Invalid drag data
    }
  };

  return (
    <div 
      className={`flex flex-col gap-1 rounded-lg transition-all duration-200 ${
        isDragging && isOver 
          ? "bg-[var(--accent)]/10 ring-2 ring-[var(--accent)] ring-dashed" 
          : isDragging 
            ? "bg-[var(--surface)]/50" 
            : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide px-1">
          {areaName}
        </span>
        {isDragging && (
          <MoveVertical className="w-3 h-3 text-[var(--text-tertiary)] animate-pulse" />
        )}
      </div>
      {children}
    </div>
  );
}

export function RoomTabs({ 
  rooms, 
  mergedRooms = [], 
  areas = [],
  activeRoom, 
  onRoomChange, 
  onManageMergedRooms,
  onMoveRoomToArea,
  onCreateArea,
  roomOrder: externalRoomOrder,
  onRoomOrderChange 
}: RoomTabsProps) {
  const hasMergedRooms = mergedRooms.length > 0;
  const hasAreas = areas.length > 0;
  
  // Internal room order state (used if no external control provided)
  const [internalRoomOrder, setInternalRoomOrder] = useState<string[]>([]);
  
  // Track if a room is being dragged for cross-area movement
  const [isDragging, setIsDragging] = useState(false);
  const [draggedRoom, setDraggedRoom] = useState<{ roomId: string; roomName: string; areaId: string | null } | null>(null);
  
  // Add area form state
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const newAreaInputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when adding area
  useEffect(() => {
    if (isAddingArea && newAreaInputRef.current) {
      newAreaInputRef.current.focus();
    }
  }, [isAddingArea]);
  
  // Handle create area
  const handleCreateArea = async () => {
    if (!onCreateArea || !newAreaName.trim()) return;
    
    setIsCreatingArea(true);
    const success = await onCreateArea(newAreaName.trim());
    setIsCreatingArea(false);
    
    if (success) {
      setNewAreaName("");
      setIsAddingArea(false);
    }
  };
  
  // Handle drag start for cross-area dragging
  const handleDragStart = (roomId: string, roomName: string, areaId: string | null) => {
    setIsDragging(true);
    setDraggedRoom({ roomId, roomName, areaId });
  };
  
  // Handle drag end
  useEffect(() => {
    const handleDragEnd = () => {
      setIsDragging(false);
      setDraggedRoom(null);
    };
    
    document.addEventListener("dragend", handleDragEnd);
    return () => document.removeEventListener("dragend", handleDragEnd);
  }, []);
  
  // Handle room drop on area
  const handleAreaDrop = (targetAreaId: string, data: { roomId: string; roomName: string; sourceAreaId: string | null }) => {
    if (onMoveRoomToArea && data.sourceAreaId !== targetAreaId) {
      onMoveRoomToArea(data.roomId, data.roomName, data.sourceAreaId, targetAreaId);
    }
    setIsDragging(false);
    setDraggedRoom(null);
  };
  
  // Use external order if provided, otherwise use internal
  const roomOrder = externalRoomOrder ?? internalRoomOrder;
  
  // Load room order from localStorage on mount
  useEffect(() => {
    if (!externalRoomOrder) {
      const saved = localStorage.getItem(ROOM_ORDER_KEY);
      if (saved) {
        try {
          setInternalRoomOrder(JSON.parse(saved));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [externalRoomOrder]);
  
  // Sort rooms based on saved order
  const sortedRooms = useCallback(() => {
    if (roomOrder.length === 0) return rooms;
    
    const orderMap = new Map(roomOrder.map((id, index) => [id, index]));
    return [...rooms].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity;
      const bIndex = orderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });
  }, [rooms, roomOrder]);
  
  // Handle reorder
  const handleReorder = (newOrder: string[]) => {
    if (onRoomOrderChange) {
      onRoomOrderChange(newOrder);
    } else {
      setInternalRoomOrder(newOrder);
      localStorage.setItem(ROOM_ORDER_KEY, JSON.stringify(newOrder));
    }
  };

  const orderedRooms = sortedRooms();
  const roomIds = orderedRooms.map(r => r.id);
  
  // Group rooms by area when areas are provided
  const roomsByArea = useCallback(() => {
    if (!hasAreas) return null;
    
    // Create a map of roomId -> area
    const roomToArea = new Map<string, Area>();
    areas.forEach(area => {
      area.roomIds.forEach(roomId => {
        roomToArea.set(roomId, area);
      });
    });
    
    // Group rooms by area
    const groups: { area: Area; rooms: RoomTab[] }[] = [];
    const unassignedRooms: RoomTab[] = [];
    
    // Create groups for each area that has rooms
    areas.forEach(area => {
      const areaRooms = orderedRooms.filter(room => roomToArea.get(room.id)?.id === area.id);
      if (areaRooms.length > 0) {
        groups.push({ area, rooms: areaRooms });
      }
    });
    
    // Find unassigned rooms
    orderedRooms.forEach(room => {
      if (!roomToArea.has(room.id)) {
        unassignedRooms.push(room);
      }
    });
    
    return { groups, unassignedRooms };
  }, [hasAreas, areas, orderedRooms]);

  const areaGroups = roomsByArea();

  return (
    <div className="flex flex-col gap-2">
      {/* Merged Rooms Row - includes All Rooms button */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* All Rooms button - now in merged row */}
        <button
          onClick={() => onRoomChange(null)}
          className={`
            shrink-0 px-4 py-2 rounded-[var(--radius-full)] text-sm font-medium
            transition-all duration-200
            ${
              activeRoom === null
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          All Rooms
        </button>
        
        {hasMergedRooms && (
          <>
            <span className="shrink-0 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide px-1">
              Merged
            </span>
            {mergedRooms.map((mergedRoom) => (
              <button
                key={mergedRoom.id}
                onClick={() => onRoomChange(mergedRoom.id)}
                className={`
                  shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-full)] text-sm font-medium
                  transition-all duration-200
                  ${
                    activeRoom === mergedRoom.id
                      ? "bg-gradient-to-r from-[var(--accent)] to-purple-500 text-white"
                      : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-dashed border-[var(--border-light)]"
                  }
                `}
              >
                <Layers className="w-3.5 h-3.5" />
                {mergedRoom.name}
              </button>
            ))}
          </>
        )}
        
        {/* Manage Merged Rooms Button */}
        {onManageMergedRooms && (
          <button
            onClick={onManageMergedRooms}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-full)] text-sm font-medium
              bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]
              transition-all duration-200 border border-dashed border-[var(--border-light)]"
            title="Manage merged rooms"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Merge</span>
          </button>
        )}
      </div>

      {/* Rooms grouped by area */}
      {hasAreas && areaGroups ? (
        <div className="flex flex-col gap-3">
          {areaGroups.groups.map(({ area, rooms: areaRooms }) => (
            <AreaDropZone
              key={area.id}
              areaId={area.id}
              areaName={area.name}
              isDragging={isDragging}
              onDrop={handleAreaDrop}
            >
              <Reorder.Group
                axis="x"
                values={areaRooms.map(r => r.id)}
                onReorder={(newOrder) => {
                  // Merge the reordered area with other rooms
                  const otherRooms = roomIds.filter(id => !areaRooms.some(r => r.id === id));
                  // Insert the new order at the position of the first room in this area
                  const firstIndex = roomIds.indexOf(areaRooms[0]?.id);
                  const merged = [...otherRooms];
                  merged.splice(firstIndex >= 0 ? firstIndex : merged.length, 0, ...newOrder);
                  handleReorder(merged);
                }}
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
              >
                {areaRooms.map((room) => (
                  <DraggableRoomButton
                    key={room.id}
                    room={room}
                    isActive={activeRoom === room.id}
                    onClick={() => onRoomChange(room.id)}
                    areaId={area.id}
                    onDragStart={handleDragStart}
                  />
                ))}
              </Reorder.Group>
            </AreaDropZone>
          ))}
          
          {/* Unassigned rooms */}
          {(areaGroups.unassignedRooms.length > 0 || isDragging) && (
            <AreaDropZone
              areaId="unassigned"
              areaName="Other"
              isDragging={isDragging}
              onDrop={handleAreaDrop}
            >
              <Reorder.Group
                axis="x"
                values={areaGroups.unassignedRooms.map(r => r.id)}
                onReorder={(newOrder) => {
                  const assignedRooms = roomIds.filter(id => !areaGroups.unassignedRooms.some(r => r.id === id));
                  handleReorder([...assignedRooms, ...newOrder]);
                }}
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide min-h-[32px]"
              >
                {areaGroups.unassignedRooms.map((room) => (
                  <DraggableRoomButton
                    key={room.id}
                    room={room}
                    isActive={activeRoom === room.id}
                    onClick={() => onRoomChange(room.id)}
                    areaId={null}
                    onDragStart={handleDragStart}
                  />
                ))}
              </Reorder.Group>
            </AreaDropZone>
          )}
          
          {/* Add Area Button/Form */}
          {onCreateArea && (
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-light)]">
              {isAddingArea ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={newAreaInputRef}
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateArea();
                      if (e.key === "Escape") {
                        setIsAddingArea(false);
                        setNewAreaName("");
                      }
                    }}
                    placeholder="Area name..."
                    className="px-3 py-1.5 text-sm rounded-lg bg-[var(--surface)] border border-[var(--border-light)] 
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                      text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    disabled={isCreatingArea}
                  />
                  <button
                    onClick={handleCreateArea}
                    disabled={!newAreaName.trim() || isCreatingArea}
                    className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] 
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Create area"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingArea(false);
                      setNewAreaName("");
                    }}
                    className="p-1.5 rounded-lg bg-[var(--surface)] text-[var(--text-secondary)] 
                      hover:bg-[var(--surface-hover)] transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingArea(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                    bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] 
                    hover:bg-[var(--surface-hover)] transition-all duration-200 
                    border border-dashed border-[var(--border-light)]"
                >
                  <Plus className="w-4 h-4" />
                  Add Area
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Regular Rooms Row - Draggable (no areas) */
        <Reorder.Group
          axis="x"
          values={roomIds}
          onReorder={(newOrder) => handleReorder(newOrder)}
          className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide"
        >
          {orderedRooms.map((room) => (
            <DraggableRoomButton
              key={room.id}
              room={room}
              isActive={activeRoom === room.id}
              onClick={() => onRoomChange(room.id)}
              areaId={null}
              onDragStart={handleDragStart}
            />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}

// Device type filter
interface DeviceTypeFilterProps {
  activeType: string | null;
  onTypeChange: (type: string | null) => void;
}

const deviceTypes = [
  { id: null, label: "All", icon: Home },
  { id: "light", label: "Lights", icon: Lightbulb },
  { id: "shade", label: "Shades", icon: Blinds },
  { id: "thermostat", label: "Climate", icon: Thermometer },
  { id: "security", label: "Security", icon: Shield },
];

export function DeviceTypeFilter({ activeType, onTypeChange }: DeviceTypeFilterProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {deviceTypes.map((type) => (
        <button
          key={type.id ?? "all"}
          onClick={() => onTypeChange(type.id)}
          className={`
            shrink-0 flex items-center gap-2 px-4 py-2 rounded-[var(--radius-full)] text-sm font-medium
            transition-all duration-200
            ${
              activeType === type.id
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          <type.icon className="w-4 h-4" />
          {type.label}
        </button>
      ))}
    </div>
  );
}

export default BottomNavigation;

