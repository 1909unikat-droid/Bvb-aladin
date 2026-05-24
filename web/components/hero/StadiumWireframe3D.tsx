"use client";
import { useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import Image from "next/image";

export default function StadiumWireframe3D() {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const springConfig = { stiffness: 120, damping: 20, mass: 0.8 };
  const x = useSpring(rawX, springConfig);
  const y = useSpring(rawY, springConfig);

  const rotateX = useTransform(y, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-14, 14]);
  const scale   = useSpring(1, { stiffness: 200, damping: 22 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top)  / rect.height - 0.5);
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-center justify-center"
      style={{ perspective: "900px" }}
      onMouseMove={onMove}
      onMouseEnter={() => scale.set(1.04)}
      onMouseLeave={() => {
        rawX.set(0);
        rawY.set(0);
        scale.set(1);
      }}
      aria-hidden
    >
      <motion.div
        style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }}
        className="relative w-full h-full"
      >
        <Image
          src="/stadion.jpg"
          alt="Signal Iduna Park"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          style={{ opacity: 0.55 }}
        />
        {/* BVB-Yellow glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 80%, rgba(253,225,0,0.12) 0%, transparent 65%)",
          }}
        />
      </motion.div>
    </div>
  );
}
