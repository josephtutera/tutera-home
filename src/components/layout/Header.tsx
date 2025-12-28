"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Thermometer,
  Shield,
  Palette,
  Lightbulb,
  Menu,
  X,
  LogOut,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { IconButton } from "@/components/ui/Button";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/climate", label: "Climate", icon: Thermometer },
  { href: "/lighting", label: "Lighting", icon: Lightbulb },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/scenes", label: "Scenes", icon: Palette },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected, processorIp, disconnect } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleDisconnect = () => {
    disconnect();
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border-light)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Tutera Home"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="font-semibold text-[var(--text-primary)] hidden sm:block">
              Tutera Home
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-4 py-2 rounded-[var(--radius-full)] text-sm font-medium
                    transition-colors duration-200
                    ${
                      isActive
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-[var(--accent-lighter)] rounded-[var(--radius-full)]"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] bg-[var(--surface)]">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-[var(--success)]" />
                  <span className="text-xs text-[var(--text-secondary)]">
                    {processorIp}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-[var(--danger)]" />
                  <span className="text-xs text-[var(--text-secondary)]">
                    Disconnected
                  </span>
                </>
              )}
            </div>

            {/* Disconnect Button */}
            <IconButton
              icon={<LogOut className="w-4 h-4" />}
              variant="ghost"
              aria-label="Disconnect"
              onClick={handleDisconnect}
              className="hidden sm:flex"
            />

            {/* Mobile Menu Button */}
            <IconButton
              icon={mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              variant="ghost"
              aria-label="Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-[var(--border-light)] bg-[var(--surface)]"
        >
          <nav className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] text-sm font-medium
                    transition-colors duration-200
                    ${
                      isActive
                        ? "bg-[var(--accent-lighter)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <hr className="my-2 border-[var(--border)]" />
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <WifiOff className="w-4 h-4 text-[var(--danger)]" />
                )}
                <span className="text-sm text-[var(--text-secondary)]">
                  {isConnected ? processorIp : "Disconnected"}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm text-[var(--danger)] font-medium"
              >
                Disconnect
              </button>
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}

export default Header;

