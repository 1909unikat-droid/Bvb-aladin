"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  /** Compact mode when header has scrolled. */
  scrolled?: boolean;
  className?: string;
}

/**
 * "09 BVB Hub" Wordmark — canonical brand lockup.
 * No BVB official logo (Markenrecht). CSS-only, no external assets.
 */
export function Wordmark09({ scrolled = false, className }: Props) {
  return (
    <div className={cn("flex items-center gap-1.5 select-none", className)}>
      {/* "09" badge */}
      <motion.div
        animate={{ scale: scrolled ? 0.88 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative h-8 w-8 rounded-lg grid place-items-center bg-bvb-yellow text-black font-black overflow-hidden"
        style={{ fontFamily: "var(--font-display)" }}
        aria-hidden
      >
        {/* Inner stripe accent */}
        <span
          className="absolute inset-0 opacity-[0.12] stripes-y pointer-events-none"
          style={{ transform: "skewY(-4deg)" }}
        />
        <span className="relative text-[17px] leading-none tracking-[-0.04em]">09</span>
      </motion.div>

      {/* Text lockup */}
      <motion.div
        animate={{ opacity: scrolled ? 0.85 : 1 }}
        className="flex flex-col leading-none"
      >
        <span
          className="text-bvb-yellow font-black tracking-[0.12em] text-[13px] uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          BVB
        </span>
        <span className="text-neutral-400 text-[9px] tracking-[0.28em] uppercase mt-[1px]">
          Hub
        </span>
      </motion.div>
    </div>
  );
}
