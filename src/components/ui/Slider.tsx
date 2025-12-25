"use client";

import { forwardRef } from "react";
import * as RadixSlider from "@radix-ui/react-slider";

interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  formatValue?: (value: number) => string;
  label?: string;
  color?: "default" | "accent" | "warning" | "success";
  className?: string;
}

const sizeMap = {
  sm: {
    track: "h-1",
    thumb: "w-4 h-4",
  },
  md: {
    track: "h-2",
    thumb: "w-5 h-5",
  },
  lg: {
    track: "h-3",
    thumb: "w-6 h-6",
  },
};

const colorMap = {
  default: "bg-[var(--accent)]",
  accent: "bg-[var(--accent)]",
  warning: "bg-[var(--warning)]",
  success: "bg-[var(--success)]",
};

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(
  ({
    value,
    defaultValue = [0],
    onValueChange,
    onValueCommit,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    orientation = "horizontal",
    size = "md",
    showValue = false,
    formatValue = (v) => `${v}%`,
    label,
    color = "default",
    className = "",
  }, ref) => {
    const sizes = sizeMap[size];
    const currentValue = value ?? defaultValue;
    
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {formatValue(currentValue[0])}
              </span>
            )}
          </div>
        )}
        <RadixSlider.Root
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          onValueCommit={onValueCommit}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          orientation={orientation}
          className={`
            relative flex items-center select-none touch-none
            ${orientation === "horizontal" ? "w-full h-5" : "flex-col w-5 h-full"}
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <RadixSlider.Track
            className={`
              relative grow rounded-full bg-[var(--border)]
              ${orientation === "horizontal" ? `w-full ${sizes.track}` : `h-full w-2`}
            `}
          >
            <RadixSlider.Range
              className={`
                absolute rounded-full ${colorMap[color]}
                ${orientation === "horizontal" ? "h-full" : "w-full"}
              `}
            />
          </RadixSlider.Track>
          <RadixSlider.Thumb
            className={`
              block ${sizes.thumb} rounded-full bg-white shadow-[var(--shadow-md)]
              border-2 border-[var(--border)]
              transition-all duration-150
              hover:border-[var(--accent)] hover:scale-110
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
              ${disabled ? "" : "cursor-grab active:cursor-grabbing"}
            `}
          />
        </RadixSlider.Root>
      </div>
    );
  }
);

Slider.displayName = "Slider";

// Vertical Slider for shades
interface VerticalSliderProps extends Omit<SliderProps, "orientation"> {
  height?: number;
}

export const VerticalSlider = forwardRef<HTMLSpanElement, VerticalSliderProps>(
  ({ height = 150, className = "", ...props }, ref) => {
    return (
      <div style={{ height }} className={`flex justify-center ${className}`}>
        <Slider ref={ref} orientation="vertical" {...props} />
      </div>
    );
  }
);

VerticalSlider.displayName = "VerticalSlider";

export default Slider;

