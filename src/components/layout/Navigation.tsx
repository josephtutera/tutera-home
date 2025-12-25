"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Thermometer,
  Shield,
  Palette,
  Lightbulb,
  Blinds,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/climate", label: "Climate", icon: Thermometer },
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
  activeRoom: string | null;
  onRoomChange: (roomId: string | null) => void;
}

export function RoomTabs({ rooms, activeRoom, onRoomChange }: RoomTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onRoomChange(room.id)}
          className={`
            shrink-0 px-4 py-2 rounded-[var(--radius-full)] text-sm font-medium
            transition-all duration-200
            ${
              activeRoom === room.id
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          {room.name}
        </button>
      ))}
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

