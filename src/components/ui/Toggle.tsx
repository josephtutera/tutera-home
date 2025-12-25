"use client";

import { forwardRef } from "react";
import * as Switch from "@radix-ui/react-switch";
import { motion } from "framer-motion";

interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: {
    root: "w-9 h-5",
    thumb: "w-4 h-4",
    translate: "translate-x-4",
  },
  md: {
    root: "w-11 h-6",
    thumb: "w-5 h-5",
    translate: "translate-x-5",
  },
  lg: {
    root: "w-14 h-7",
    thumb: "w-6 h-6",
    translate: "translate-x-7",
  },
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, defaultChecked, onCheckedChange, disabled = false, size = "md", label, className = "" }, ref) => {
    const sizes = sizeMap[size];
    
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Switch.Root
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={`
            ${sizes.root}
            relative inline-flex shrink-0 cursor-pointer rounded-full
            transition-colors duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            data-[state=checked]:bg-[var(--accent)]
            data-[state=unchecked]:bg-[var(--border)]
          `}
        >
          <Switch.Thumb
            className={`
              ${sizes.thumb}
              pointer-events-none block rounded-full bg-white shadow-lg
              transition-transform duration-200 ease-in-out
              translate-x-0.5
              data-[state=checked]:${sizes.translate}
            `}
          />
        </Switch.Root>
        {label && (
          <label className="text-sm text-[var(--text-secondary)] cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Toggle.displayName = "Toggle";

// Animated Toggle with icon states
interface AnimatedToggleProps extends ToggleProps {
  onIcon?: React.ReactNode;
  offIcon?: React.ReactNode;
}

export const AnimatedToggle = forwardRef<HTMLButtonElement, AnimatedToggleProps>(
  ({ checked, defaultChecked, onCheckedChange, disabled = false, size = "md", label, onIcon, offIcon, className = "" }, ref) => {
    const sizes = sizeMap[size];
    
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Switch.Root
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={`
            ${sizes.root}
            relative inline-flex shrink-0 cursor-pointer rounded-full
            transition-colors duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            data-[state=checked]:bg-[var(--accent)]
            data-[state=unchecked]:bg-[var(--border)]
          `}
        >
          <Switch.Thumb asChild>
            <motion.span
              className={`
                ${sizes.thumb}
                pointer-events-none flex items-center justify-center rounded-full bg-white shadow-lg
              `}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{
                x: checked ? parseInt(sizes.translate.replace("translate-x-", "")) * 4 : 2,
              }}
            >
              {checked ? onIcon : offIcon}
            </motion.span>
          </Switch.Thumb>
        </Switch.Root>
        {label && (
          <label className="text-sm text-[var(--text-secondary)] cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    );
  }
);

AnimatedToggle.displayName = "AnimatedToggle";

export default Toggle;

