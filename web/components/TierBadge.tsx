import type { Tier } from "@/types/news";
import { cn } from "@/lib/cn";

interface Props { tier: Tier; source: string; }

export function TierBadge({ tier, source }: Props) {
  if (tier === 1) {
    return (
      <span
        className="pulse-glow inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-300 via-bvb-yellow to-amber-400 text-black"
      >
        Insider
      </span>
    );
  }
  if (tier === 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-bvb-yellow text-black">
        Offiziell
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase border",
        tier === 2
          ? "border-asphalt-500 text-neutral-200 bg-asphalt-700"
          : "border-asphalt-600 text-neutral-400 bg-asphalt-800"
      )}
      title={`Tier ${tier}`}
    >
      {source.length > 18 ? source.slice(0, 17) + "…" : source}
    </span>
  );
}
