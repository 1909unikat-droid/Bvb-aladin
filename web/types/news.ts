/**
 * BVB-Fanpage — Data contract for the news feed served by bvb-aladin.
 *
 * Source of truth (live):
 *   https://bvb-aladin.vercel.app/data/news.json    (ISR 60s, CORS: *)
 *
 * Fallback (build-time snapshot):
 *   /public/data/news.json
 *
 * The shape below was derived from a live snapshot
 * (updated_at = 2026-05-19T16:44:01.943491+00:00, 101 items).
 *
 * Conventions:
 *   - All timestamps are ISO-8601 with a timezone offset (mostly +00:00).
 *   - `id` is a 16-char hex hash (stable per item).
 *   - `score` is in [0..10], typically 3.5..6.6 in current data.
 *   - All `components.*` fields are in [0..1].
 *   - `published` is REQUIRED in every observed item, but the consumer
 *     MUST defensively treat it as possibly missing (legacy items / future
 *     feed changes). Use `published ?? updated_at` as a last-resort
 *     fallback when sorting/formatting.
 *   - Strings may contain emoji, German umlauts, and zero-width chars.
 */

/* ──────────────────────────────────────────────────────────────────── */
/*  Enums / string-literal unions                                       */
/* ──────────────────────────────────────────────────────────────────── */

/** High-level topic bucket assigned by the bvb-aladin classifier. */
export type Category =
  | "transfers"
  | "injury"
  | "matchday"
  | "official"
  | "background"
  | "other";

/** Origin medium of the item. */
export type Kind = "rss" | "x" | "youtube" | "podcast";

/**
 * Source-credibility tier.
 *   1 = Insider journalists (Romano, Plettenberg, Berger, …)
 *   2 = Established outlets (kicker, Ruhr Nachrichten, RUHR24, …)
 *   3 = Official BVB channels (@BVB, bvb.de)
 *   4 = Tabloid / fan media
 *   5 = Pure social (random X / Reddit threads)
 */
export type Tier = 1 | 2 | 3 | 4 | 5;

/* ──────────────────────────────────────────────────────────────────── */
/*  Sub-shapes                                                          */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * A single source that corroborates a NewsItem.
 * Even single-source items always carry one Confirmation that mirrors
 * the parent item — never assume length > 1.
 */
export interface Confirmation {
  /** Human-readable source name, e.g. "Fabrizio Romano". */
  source: string;
  /** Canonical URL of the corroborating post/article. */
  url: string;
  /** Tier of the corroborating source (may differ from the lead item). */
  tier: Tier;
  /** Optional — present in clustered/merged items; ISO-8601. */
  published?: string;
}

/**
 * Per-axis score breakdown used to compute the final `score`.
 * Each value is in [0..1] and the final score is a weighted sum the
 * UI does NOT need to recompute — only visualise.
 *
 * Tooltip mapping (German):
 *   credibility   → "Quellen-Glaubwürdigkeit"
 *   confirmation  → "Mehrfach-Bestätigung"
 *   recency       → "Aktualität"
 *   specificity   → "Konkretheit"
 *   relevance     → "BVB-Bezug"
 */
export interface ScoreComponents {
  credibility: number;
  confirmation: number;
  recency: number;
  specificity: number;
  relevance: number;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Main item                                                           */
/* ──────────────────────────────────────────────────────────────────── */

export interface NewsItem {
  /** Stable 16-char hex hash; safe to use as React key and route param. */
  id: string;

  /**
   * Display headline.
   * For RSS items this is a real headline (~30–120 chars).
   * For `kind === "x"` this often equals the full tweet text and can
   * exceed 400 chars including embedded URLs — UI MUST clamp & ellipsise.
   */
  title: string;

  /**
   * Lead-in / teaser body. For X-posts this is nearly identical to
   * `title` (URLs get prettified, e.g. "whatsapp.com/channel/0029Vb8…").
   * Treat `summary === title` as a signal to hide the summary in the UI.
   */
  summary: string;

  /** Canonical link the card opens (target=_blank, rel=noopener). */
  url: string;

  /**
   * ISO-8601 publish timestamp. REQUIRED in current data but typed
   * optional for forward-compat. Use the helper `getPublished()` below.
   */
  published?: string;

  /** Display label of the source ("Patrick Berger", "kicker BVB", …). */
  source: string;

  /**
   * Machine-readable source identifier.
   * Observed values:
   *   x_romano | x_berger | x_plettenberg | x_bvb |
   *   rn_bvb   | kicker_bvb | ruhr24_bvb
   * Will grow over time — do NOT make this a union type.
   */
  source_id: string;

  tier: Tier;
  kind: Kind;

  /** Composite score in [0..10]. Used to sort & to drive Hero-Card pick. */
  score: number;

  category: Category;

  /**
   * Always non-empty in current data.
   * Length 1  → single-source story.
   * Length ≥2 → "↻ N Quellen" badge + click-modal.
   */
  confirmations: Confirmation[];

  /** Convenience mirror of `confirmations.length`. */
  confirmation_count: number;

  components: ScoreComponents;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Top-level feed                                                      */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * Optional aggregate counters emitted by bvb-aladin at the end of the
 * feed. Not part of the spec in the master prompt — present in real
 * data and useful for telemetry / debug overlays. Treat as untrusted.
 */
export interface FeedStats {
  total: number;
  raw_total: number;
  clusters: number;
  by_tier: Partial<Record<`${Tier}`, number>>;
  by_category: Partial<Record<Category, number>>;
  sources_ok: number;
  sources_fail: number;
}

export interface NewsFeed {
  /** ISO-8601 — drives the "Neue News verfügbar" live-update toast. */
  updated_at: string;
  items: NewsItem[];
  /** Optional, may be omitted in older snapshots. */
  stats?: FeedStats;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Helpers (pure, no deps) — kept here so types + invariants travel    */
/*  together. Architect/coder may move them into /lib if preferred.     */
/* ──────────────────────────────────────────────────────────────────── */

/** Returns a usable timestamp even if `published` is missing. */
export const getPublished = (item: NewsItem, feedUpdatedAt: string): string =>
  item.published ?? feedUpdatedAt;

/** True if the summary adds no information over the title. */
export const isRedundantSummary = (item: NewsItem): boolean => {
  const t = item.title.trim();
  const s = item.summary.trim();
  if (s.length === 0) return true;
  if (s === t) return true;
  // X-feed pattern: summary is a prefix of title with URL prettified.
  if (t.startsWith(s.slice(0, Math.min(80, s.length - 5)))) return true;
  return false;
};

/** Score → 0..5 bar segments (UI display). */
export const scoreSegments = (score: number): 0 | 1 | 2 | 3 | 4 | 5 => {
  const seg = Math.max(0, Math.min(5, Math.round(score / 2)));
  return seg as 0 | 1 | 2 | 3 | 4 | 5;
};

/** Hero-eligible: top story strip & big 16:9 card. */
export const isHeroCandidate = (item: NewsItem): boolean => item.score >= 6.5;

/** Hot tab: score ≥ 6 within the last 6h. */
export const isHot = (item: NewsItem, now: Date = new Date()): boolean => {
  if (item.score < 6) return false;
  if (!item.published) return false;
  const ageMs = now.getTime() - new Date(item.published).getTime();
  return ageMs <= 6 * 60 * 60 * 1000;
};

/** Live-dot indicator: items younger than 60 min. */
export const isLive = (item: NewsItem, now: Date = new Date()): boolean => {
  if (!item.published) return false;
  return now.getTime() - new Date(item.published).getTime() < 60 * 60 * 1000;
};
