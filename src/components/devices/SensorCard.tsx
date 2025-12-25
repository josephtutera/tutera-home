"use client";

import { motion } from "framer-motion";
import {
  Activity,
  DoorOpen,
  DoorClosed,
  Thermometer,
  Droplets,
  Sun,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Sensor } from "@/lib/crestron/types";

interface SensorCardProps {
  sensor: Sensor;
  compact?: boolean;
}

const sensorConfig = {
  motion: {
    icon: Activity,
    color: "#8B5CF6",
    trueLabel: "Motion Detected",
    falseLabel: "No Motion",
  },
  contact: {
    icon: DoorClosed,
    trueIcon: DoorClosed,
    falseIcon: DoorOpen,
    color: "#3B82F6",
    trueLabel: "Closed",
    falseLabel: "Open",
  },
  temperature: {
    icon: Thermometer,
    color: "#EF4444",
    unit: "°F",
  },
  humidity: {
    icon: Droplets,
    color: "#06B6D4",
    unit: "%",
  },
  luminance: {
    icon: Sun,
    color: "#F59E0B",
    unit: "lux",
  },
};

export function SensorCard({ sensor, compact = false }: SensorCardProps) {
  const config = sensorConfig[sensor.subType] || {
    icon: Eye,
    color: "#6B7280",
  };
  
  const isBooleanSensor = sensor.subType === "motion" || sensor.subType === "contact";
  const value = sensor.value;
  
  // Determine icon for contact sensors
  let Icon = config.icon;
  if (sensor.subType === "contact") {
    Icon = value ? sensorConfig.contact.trueIcon : sensorConfig.contact.falseIcon;
  }

  // Format display value
  let displayValue: string;
  let isActive = false;
  
  if (isBooleanSensor) {
    const boolConfig = config as typeof sensorConfig.motion | typeof sensorConfig.contact;
    isActive = Boolean(value);
    displayValue = isActive ? boolConfig.trueLabel : boolConfig.falseLabel;
  } else {
    const numConfig = config as typeof sensorConfig.temperature;
    displayValue = `${value}${numConfig.unit || sensor.unit || ""}`;
  }

  if (compact) {
    return (
      <Card
        padding="sm"
        className={`
          transition-all duration-300
          ${isBooleanSensor && isActive ? `bg-opacity-10` : ""}
        `}
        style={{
          backgroundColor: isBooleanSensor && isActive ? `${config.color}10` : undefined,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                {sensor.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {displayValue}
              </p>
            </div>
          </div>
          {isBooleanSensor && isActive && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.color }}
            />
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-7 h-7" style={{ color: config.color }} />
        </div>
        <div className="flex-1">
          <p className="font-medium text-[var(--text-primary)]">{sensor.name}</p>
          <p className="text-sm text-[var(--text-secondary)] capitalize">
            {sensor.subType} sensor
          </p>
        </div>
        <div className="text-right">
          {isBooleanSensor ? (
            <div className="flex items-center gap-2">
              {isActive && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
              )}
              <span
                className="text-sm font-medium"
                style={{ color: isActive ? config.color : "var(--text-secondary)" }}
              >
                {displayValue}
              </span>
            </div>
          ) : (
            <p className="text-2xl font-semibold" style={{ color: config.color }}>
              {displayValue}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// Sensor summary for dashboard
interface SensorSummaryProps {
  sensors: Sensor[];
}

export function SensorSummary({ sensors }: SensorSummaryProps) {
  const motionSensors = sensors.filter(s => s.subType === "motion");
  const contactSensors = sensors.filter(s => s.subType === "contact");
  const tempSensors = sensors.filter(s => s.subType === "temperature");
  
  const activeMotion = motionSensors.filter(s => Boolean(s.value)).length;
  const openDoors = contactSensors.filter(s => !Boolean(s.value)).length;
  const avgTemp = tempSensors.length > 0
    ? Math.round(tempSensors.reduce((sum, s) => sum + Number(s.value), 0) / tempSensors.length)
    : null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {motionSensors.length > 0 && (
        <div className="p-3 bg-[var(--surface)] rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-xs text-[var(--text-secondary)]">Motion</span>
          </div>
          <p className="text-lg font-semibold">
            {activeMotion > 0 ? `${activeMotion} active` : "Clear"}
          </p>
        </div>
      )}
      
      {contactSensors.length > 0 && (
        <div className="p-3 bg-[var(--surface)] rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <DoorClosed className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs text-[var(--text-secondary)]">Doors</span>
          </div>
          <p className={`text-lg font-semibold ${openDoors > 0 ? "text-[var(--warning)]" : ""}`}>
            {openDoors > 0 ? `${openDoors} open` : "All closed"}
          </p>
        </div>
      )}
      
      {avgTemp !== null && (
        <div className="p-3 bg-[var(--surface)] rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer className="w-4 h-4 text-[#EF4444]" />
            <span className="text-xs text-[var(--text-secondary)]">Avg Temp</span>
          </div>
          <p className="text-lg font-semibold">{avgTemp}°F</p>
        </div>
      )}
    </div>
  );
}

export default SensorCard;

