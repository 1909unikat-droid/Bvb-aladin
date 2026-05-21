/**
 * Deterministic daily briefing composer.
 *
 * No runtime LLM. Pure rule-based selection:
 *   1. Filter items to those published on the briefing date (default: today).
 *   2. Pick up to 12 items with tier-mix enforcement:
 *      - At least 1 from tier 1-2 (if available)
 *      - At least 1 from tier 3 (official, if available)
 *   3. Group into category sections in display order.
 *   4. Compose a deterministic German headline from top item.
 *
 * The "09:09 Briefing" convention: show items from the last 24h,
 * call it the morning briefing for today's date regardless of call time.
 */

import type { NewsItem, Category } from "@/types/news";

/* ── public types ─────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<Category, string> = {
  transfers:  "Transfers & Geruchte",
  injury:     "Verletzungen & Fitness",
  matchday:   "Spieltag & Taktik",
  official:   "Offizielles",
  background: "Hintergrund",
  other:      "Sonstiges",
};

const CATEGORY_ORDER: Category[] = [
  "official",
  "transfers",
  "matchday",
  "injury",
  "background",
  "other",
];

export interface BriefingSection {
  category: Category;
  label: string;
  items: NewsItem[];
}

export interface DailyBriefing {
  /** YYYY-MM-DD */
  date: string;
  /** Single-line German headline derived from the top item. */
  headline: string;
  sections: BriefingSection[];
  totalItems: number;
  /** Score of the top-ranked item in this briefing. */
  topScore: number;
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function itemAge(item: NewsItem, now: Date): number {
  const pub = item.published ? new Date(item.published) : now;
  return (now.getTime() - pub.getTime()) / 3_600_000; // hours
}

function buildHeadline(lead: NewsItem): string {
  // Truncate overly long titles (X-posts can be 400+ chars)
  const t = lead.title.replace(/https?:\/\/\S+/g, "").trim();
  return t.length > 110 ? t.slice(0, 108) + "\u2026" : t;
}

/* ── main export ─────────────────────────────────────────────────────── */

/**
 * Composes a DailyBriefing from the full feed.
 *
 * @param items  All news items (unsorted).
 * @param date   Reference date (default: now). Items within the last 24h
 *               relative to this date are included.
 * @param maxItems Maximum items in the briefing (default 12).
 */
export function composeBriefing(
  items: NewsItem[],
  date: Date = new Date(),
  maxItems = 12,
): DailyBriefing {
  const dateStr = toDateStr(date);

  // 1. Keep items from the last 24h
  const recent = items
    .filter((it) => itemAge(it, date) <= 24)
    .sort((a, b) => b.score - a.score);

  // 2. Tier-mix selection
  const selected: NewsItem[] = [];
  const usedIds = new Set<string>();

  // Always include at least one tier-1/2 item if available
  const elite = recent.find((it) => it.tier <= 2);
  if (elite) { selected.push(elite); usedIds.add(elite.id); }

  // Include at least one official item (tier 3) if available
  const official = recent.find((it) => it.tier === 3 && !usedIds.has(it.id));
  if (official) { selected.push(official); usedIds.add(official.id); }

  // Fill remaining slots by score
  for (const it of recent) {
    if (selected.length >= maxItems) break;
    if (!usedIds.has(it.id)) {
      selected.push(it);
      usedIds.add(it.id);
    }
  }

  // Re-sort final selection by score
  selected.sort((a, b) => b.score - a.score);

  // 3. Group into sections
  const byCategory = new Map<Category, NewsItem[]>();
  for (const it of selected) {
    const bucket = byCategory.get(it.category) ?? [];
    bucket.push(it);
    byCategory.set(it.category, bucket);
  }

  const sections: BriefingSection[] = CATEGORY_ORDER
    .filter((cat) => byCategory.has(cat))
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: byCategory.get(cat)!,
    }));

  const lead = selected[0];

  return {
    date: dateStr,
    headline: lead ? buildHeadline(lead) : "Keine aktuellen Meldungen",
    sections,
    totalItems: selected.length,
    topScore: lead?.score ?? 0,
  };
}

/**
 * Returns a short human-readable label for the briefing date, e.g.
 * "Heute" / "Gestern" / "Mo, 19. Mai".
 */
export function briefingDateLabel(dateStr: string, now: Date = new Date()): string {
  const d = new Date(dateStr + "T12:00:00");
  const todayStr = toDateStr(now);
  const yesterdayStr = toDateStr(new Date(now.getTime() - 86_400_000));
  if (dateStr === todayStr) return "Heute";
  if (dateStr === yesterdayStr) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" });
}
