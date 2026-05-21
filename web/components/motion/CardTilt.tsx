"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  className?: string;
  /** Max tilt in degrees. Default 8. */
  maxTilt?: number;
  /** Scale on hover. Default 1.02. */
  scale?: number;
}

/**
 * 2.5D perspective tilt card — Framer Motion only, no R3F.
 * Follows cursor/touch within the element.
 * Automatically a no-op on prefers-reduced-motion via Framer Motion.
 */
export function CardTilt({ children, className, maxTilt = 8, scale = 1.02 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 180, damping: 22 });
  const y = useSpring(rawY, { stiffness: 180, damping: 22 });

  const rotateX = useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const shimmerX = useTransform(x, [-0.5, 0.5], ["0%", "100%"]);
  const shimmerOpacity = useTransform(
    x,
    [-0.5, 0, 0.5],
    [0.08, 0, 0.08]
  );

  function onMove(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = "touches" in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    rawX.set((clientX - rect.left) / rect.width - 0.5);
    rawY.set((clientY - rect.top) / rect.height - 0.5);
  }

  function onLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={cn("relative", className)}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 800 }}
      whileHover={{ scale }}
      transition={{ scale: { duration: 0.2 } }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchMove={onMove}
      onTouchEnd={onLeave}
    >
      {children}

      {/* Specular shimmer overlay */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: `radial-gradient(circle at ${shimmerX} 50%, rgba(253,225,0,0.18), transparent 60%)`,
          opacity: shimmerOpacity,
        }}
      />
    </motion.div>
  );
}
