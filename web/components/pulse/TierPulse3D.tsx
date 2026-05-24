"use client";

import { motion } from "framer-motion";
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

interface Props {
  counts: Partial<Record<Tier, number>>;
}

export default function TierPulse3D({ counts }: Props) {
  const tiers: Tier[] = [1, 2, 3, 4, 5];
  const max = Math.max(1, ...(Object.values(counts).filter(Boolean) as number[]));

  return (
    <div className="flex items-end justify-around gap-2 h-full pb-5 px-3" aria-hidden>
      {tiers.map((tier, i) => {
        const pct = Math.max(4, ((counts[tier] ?? 0) / max) * 100);
        const color = TIER_COLORS[tier];
        return (
          <div key={tier} className="flex flex-col items-center gap-1 flex-1 h-full">
            <div className="flex-1 w-full flex items-end">
              <motion.div
                className="w-full rounded-sm"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }}
                initial={{ height: "4%" }}
                animate={{
                  height: `${pct}%`,
                  opacity: [0.75, 1, 0.75],
                }}
                transition={{
                  height: { duration: 0.9, delay: i * 0.08, ease: "easeOut" },
                  opacity: { duration: 2.4, delay: i * 0.35, repeat: Infinity, ease: "easeInOut" },
                }}
              />
            </div>
            <span className="text-[9px] text-neutral-500">{TIER_LABELS[tier]}</span>
          </div>
        );
      })}
    </div>
  );
}
