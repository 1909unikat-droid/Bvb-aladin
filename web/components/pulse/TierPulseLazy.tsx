"use client";

import dynamic from "next/dynamic";
import type { Tier } from "@/types/news";

const TIER_LABELS: Record<Tier, string> = {
  1: "Insider", 2: "Medien", 3: "Offiziell", 4: "Fan", 5: "Social",
};
const TIER_COLORS: Record<Tier, string> = {
  1: "bg-bvb-yellow", 2: "bg-bvb-yellow/60", 3: "bg-bvb-yellow/80",
  4: "bg-asphalt-500", 5: "bg-asphalt-600",
};

function TierPulseFallback({ counts }: { counts: Partial<Record<Tier, number>> }) {
  const tiers: Tier[] = [1, 2, 3, 4, 5];
  const max = Math.max(1, ...(Object.values(counts).filter(Boolean) as number[]));
  return (
    <div className="flex items-end justify-around gap-1 h-full pb-5 px-2">
      {tiers.map((tier) => {
        const pct = ((counts[tier] ?? 0) / max) * 100;
        return (
          <div key={tier} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full rounded-sm" style={{ height: `${Math.max(4, pct)}%` }}>
              <div className={`w-full h-full rounded-sm ${TIER_COLORS[tier]}`} />
            </div>
            <span className="text-[9px] text-neutral-500">{TIER_LABELS[tier]}</span>
          </div>
        );
      })}
    </div>
  );
}

const TierPulseAnimated = dynamic(() => import("./TierPulse3D"), {
  ssr: false,
  loading: () => <TierPulseFallback counts={{}} />,
});

interface Props {
  counts: Partial<Record<Tier, number>>;
}

export function TierPulseLazy({ counts }: Props) {
  return <TierPulseAnimated counts={counts} />;
}
