/**
 * Echte-Liebe Vibe Index — 24h emotional pulse of the BVB news stream.
 *
 * Formula:
 *   1. Collect items published in the last 24h.
 *   2. Apply exponential time-decay: weight = exp(-age_hours / HALF_LIFE).
 *   3. Compute weighted-average base score (0–10 → 0–1).
 *   4. Compute fan-tier ratio: share of items from tier 4+5 (fan voice).
 *   5. Scale by an activity multiplier (log of item count normalised to 0–1).
 *   6. Combine → raw vibe in [0, 1] → map to 0–100.
 *
 * Weights:
 *   60% weighted base score  (quality signal)
 *   25% activity level       (quantity signal — more news = more energy)
 *   15% fan-tier ratio       (emotional temperature)
 *
 * Label thresholds (0–100):
 *   0–19   → "still"       (very quiet, barely any news)
 *   20–39  → "ruhig"       (calm day)
 *   40–59  → "lebendig"    (active, normal matchday chatter)
 *   60–79  → "heiß"        (transfer window / big match energy)
 *   80–100 → "explodiert"  (breaking news / title race fever)
 */

import type { NewsItem } from "@/types/news";

/* ── config ─────────────────────────────────────────────────────────── */

/** Hours for decay half-life (score halves every 8h). */
const HALF_LIFE = 8;

/**
 * Activity ceiling: at this many items the activity multiplier reaches 1.
 * A feed of 40+ items/24h is "maximally active".
 */
const ACTIVITY_CEILING = 40;

/* ── public types ────────────────────────────────────────────────────── */

export type VibeLabel = "still" | "ruhig" | "lebendig" | "heiß" | "explodiert";

export interface VibeIndex {
  /** Integer 0–100. */
  score: number;
  label: VibeLabel;
  /** Number of items published in the last 24h. */
  itemCount24h: number;
  /** Share of fan/social items (tier 4–5) among 24h items, 0–1. */
  fanTierRatio: number;
  /** Weighted average score of 24h items, 0–10. */
  avgScore: number;
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function ageHours(item: NewsItem, now: Date): number {
  if (!item.published) return 24;
  return Math.max(0, (now.getTime() - new Date(item.published).getTime()) / 3_600_000);
}

function decayWeight(ageH: number): number {
  return Math.exp((-Math.LN2 * ageH) / HALF_LIFE);
}

function labelFor(score: number): VibeLabel {
  if (score >= 80) return "explodiert";
  if (score >= 60) return "heiß";
  if (score >= 40) return "lebendig";
  if (score >= 20) return "ruhig";
  return "still";
}

/* ── main export ─────────────────────────────────────────────────────── */

/**
 * Computes the Echte-Liebe Vibe Index from the full feed items.
 *
 * @param items  All news items (published any time).
 * @param now    Reference time (default: Date.now). Useful for testing.
 */
export function computeVibeIndex(items: NewsItem[], now: Date = new Date()): VibeIndex {
  // 1. Filter to last 24h
  const recent = items.filter((it) => ageHours(it, now) <= 24);

  if (recent.length === 0) {
    return { score: 0, label: "still", itemCount24h: 0, fanTierRatio: 0, avgScore: 0 };
  }

  // 2. Weighted score average
  let weightSum = 0;
  let weightedScore = 0;
  let fanCount = 0;

  for (const it of recent) {
    const w = decayWeight(ageHours(it, now));
    weightSum += w;
    weightedScore += it.score * w;
    if (it.tier >= 4) fanCount++;
  }

  const avgScore = weightSum > 0 ? weightedScore / weightSum : 0; // 0–10
  const fanTierRatio = fanCount / recent.length; // 0–1

  // 3. Activity multiplier (0–1): log-scaled, ceiling at ACTIVITY_CEILING items
  const activityRaw = Math.min(1, Math.log1p(recent.length) / Math.log1p(ACTIVITY_CEILING));

  // 4. Combine
  const raw =
    (avgScore / 10) * 0.60 +
    activityRaw     * 0.25 +
    fanTierRatio    * 0.15;

  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));

  return {
    score,
    label: labelFor(score),
    itemCount24h: recent.length,
    fanTierRatio: Math.round(fanTierRatio * 100) / 100,
    avgScore: Math.round(avgScore * 10) / 10,
  };
}

/**
 * Human-readable German description of a vibe label.
 */
export const VIBE_DESCRIPTIONS: Record<VibeLabel, string> = {
  still:      "Stille — wenig los heute",
  ruhig:      "Ruhiger Tag im Revier",
  lebendig:   "Der BVB lebt — aktiver Tag",
  heiß:       "Feuer-Alarm im Borusseum",
  explodiert: "Echte Liebe explodiert gerade!",
};

/**
 * CSS color class for a vibe label (Tailwind).
 */
export const VIBE_COLORS: Record<VibeLabel, string> = {
  still:      "text-neutral-500",
  ruhig:      "text-neutral-300",
  lebendig:   "text-bvb-yellow/80",
  heiß:       "text-bvb-yellow",
  explodiert: "text-bvb-yellow drop-shadow-[0_0_8px_#fde100]",
};
