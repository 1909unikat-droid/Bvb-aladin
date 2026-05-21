"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Tier } from "@/types/news";

const TIER_COLORS: Record<Tier, string> = {
  1: "#fde100",
  2: "#d4bd00",
  3: "#fde100",
  4: "#3a3a3a",
  5: "#1a1a1a",
};

const TIER_LABELS: Record<Tier, string> = {
  1: "Insider",
  2: "Medien",
  3: "Offiziell",
  4: "Fan",
  5: "Social",
};

interface BarProps {
  x: number;
  height: number;
  color: string;
  delay: number;
}

function PulseBar({ x, height, color, delay }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetH = useRef(height);
  const currentH = useRef(0.05);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Smooth grow toward target
    currentH.current += (targetH.current - currentH.current) * Math.min(delta * 2.5, 1);
    // Gentle idle pulse
    const pulse = 1 + Math.sin(Date.now() * 0.001 + delay) * 0.04;
    const h = currentH.current * pulse;
    meshRef.current.scale.y = h;
    meshRef.current.position.y = h * 0.5 - 0.05;
  });

  const geo = useMemo(() => new THREE.BoxGeometry(0.42, 1, 0.42), []);

  return (
    <mesh ref={meshRef} position={[x, 0, 0]} geometry={geo}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        roughness={0.4}
        metalness={0.6}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

interface Props {
  counts: Partial<Record<Tier, number>>;
}

export default function TierPulse3D({ counts }: Props) {
  const tiers: Tier[] = [1, 2, 3, 4, 5];
  const max = Math.max(1, ...Object.values(counts).filter(Boolean) as number[]);

  const bars = tiers.map((tier, i) => ({
    tier,
    x: (i - 2) * 0.7,
    height: Math.max(0.05, ((counts[tier] ?? 0) / max) * 2.2),
    color: TIER_COLORS[tier],
    delay: i * 0.8,
  }));

  return (
    <div className="relative w-full h-full" aria-hidden>
      <Canvas
        camera={{ position: [0, 1.2, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 4, 4]} intensity={1.5} color="#fde100" />
        <pointLight position={[-3, 2, 2]} intensity={0.4} color="#ffffff" />
        {bars.map((b) => (
          <PulseBar key={b.tier} x={b.x} height={b.height} color={b.color} delay={b.delay} />
        ))}
      </Canvas>

      {/* Tier labels underneath */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around px-2 pb-1 pointer-events-none">
        {tiers.map((tier) => (
          <span key={tier} className="text-[9px] text-neutral-500 text-center w-[20%]">
            {TIER_LABELS[tier]}
          </span>
        ))}
      </div>
    </div>
  );
}
