"use client";

import { Card } from "@/components/ui/Card";
import { LightCard, LightGroupControl } from "@/components/devices/LightCard";
import type { LightingRoomGroup } from "@/stores/deviceStore";
import { Building2 } from "lucide-react";

interface LightingRoomGroupComponentProps {
  group: LightingRoomGroup;
}

export function LightingRoomGroup({ group }: LightingRoomGroupComponentProps) {
  const { roomName, lights, lightsOn, totalLights, avgBrightness } = group;
  
  const lightsOff = totalLights - lightsOn;

  return (
    <Card padding="lg" className="bg-gradient-to-br from-yellow-500/5 to-transparent">
      {/* Room Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {roomName}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {totalLights} {totalLights === 1 ? 'light' : 'lights'}
              {lightsOn > 0 && ` • ${lightsOn} on`}
              {lightsOff > 0 && ` • ${lightsOff} off`}
            </p>
          </div>
        </div>
        
        {/* Brightness indicator */}
        {lightsOn > 0 && (
          <div className="ml-[52px]">
            <p className="text-xl font-semibold text-[var(--text-primary)]">
              {avgBrightness}% avg brightness
            </p>
          </div>
        )}
      </div>

      {/* Room Group Control */}
      {lights.length > 0 && (
        <div className="mb-6">
          <LightGroupControl lights={lights} roomName={roomName} standalone={true} />
        </div>
      )}

      {/* Individual Lights */}
      {lights.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Individual Lights
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lights.map((light) => (
              <LightCard key={light.id} light={light} compact />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default LightingRoomGroup;

