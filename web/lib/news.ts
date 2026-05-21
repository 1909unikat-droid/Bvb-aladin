import type { NewsItem, Category, Kind, Tier } from "@/types/news";

/* ── Filtering ───────────────────────────────────────────────────────── */

export interface FilterState {
  category?: Category;
  kind?: Kind;
  tier?: Tier;
  query?: string;
  sinceHours?: number;
  extraSourceIds?: string[]; // always include these source_ids regardless of kind
}

export function filterItems(items: NewsItem[], f: FilterState): NewsItem[] {
  const q = f.query?.trim().toLowerCase() ?? "";
  const cutoff = f.sinceHours ? Date.now() - f.sinceHours * 3600_000 : null;
  return items.filter((it) => {
    if (f.category && it.category !== f.category) return false;
    if (f.kind && it.kind !== f.kind && !f.extraSourceIds?.includes(it.source_id)) return false;
    if (f.tier && it.tier !== f.tier) return false;
    if (cutoff && it.published) {
      const t = new Date(it.published).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
    }
    if (q) {
      const hay = (it.title + " " + it.summary + " " + it.source).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ── Formatting ──────────────────────────────────────────────────────── */

const RTF = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Infinity]
];

export function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  let diff = (t - Date.now()) / 1000;
  for (const [unit, step] of UNITS) {
    if (Math.abs(diff) < step) return RTF.format(Math.round(diff), unit);
    diff /= step;
  }
  return "";
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* ── Category labels (DE) ────────────────────────────────────────────── */

export const CATEGORY_LABEL: Record<Category, string> = {
  transfers: "Transfers",
  injury: "Verletzungen",
  matchday: "Spieltag",
  official: "Offiziell",
  background: "Hintergrund",
  other: "Sonstiges"
};

export const KIND_LABEL: Record<Kind, string> = {
  rss: "Artikel",
  x: "Tweet",
  youtube: "Video",
  podcast: "Podcast"
};
