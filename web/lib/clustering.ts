/**
 * Build-time story clustering.
 *
 * Algorithm:
 *   1. Tokenise each title (lowercase, drop stopwords, 3+ char tokens).
 *   2. Compute Jaccard similarity of token-sets between every pair.
 *   3. Boost with a same-category flag (weight 0.25).
 *   4. If combined similarity >= THRESHOLD → same cluster (union-find).
 *   5. Within each cluster the highest-score item is the `lead`.
 *
 * Pure / no side-effects — safe to call at build time (server-only) or
 * inside a useMemo on the client (small N, typically < 300 items).
 */

import type { NewsItem, Category } from "@/types/news";

/* ── config ──────────────────────────────────────────────────────────── */

const THRESHOLD = 0.55;

const DE_STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "und", "oder", "aber", "mit", "von", "aus", "bei", "für",
  "über", "an", "am", "im", "in", "ist", "sind", "war", "wird", "wurde",
  "hat", "haben", "beim", "zur", "zum", "auf", "nach", "wie", "als", "nicht",
  "er", "sie", "es", "wir", "ich", "du", "ihr", "sich", "zu", "so", "auch",
  "vor", "durch", "noch", "mehr", "dann", "bvb", "borussia", "dortmund",
]);

/* ── public types ─────────────────────────────────────────────────────── */

export interface StoryCluster {
  /** Stable id = lead item id. */
  id: string;
  /** Highest-score item in the cluster. */
  lead: NewsItem;
  /** All items including lead, sorted score desc. */
  items: NewsItem[];
  size: number;
  category: Category;
}

/* ── tokenisation ─────────────────────────────────────────────────────── */

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-züäöß0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !DE_STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function similarity(a: NewsItem, b: NewsItem, tokensA: Set<string>, tokensB: Set<string>): number {
  const j = jaccard(tokensA, tokensB);
  const catBoost = a.category === b.category ? 0.25 : 0;
  return Math.min(1, j * 0.75 + catBoost);
}

/* ── union-find ───────────────────────────────────────────────────────── */

function makeUF(n: number) {
  const parent: number[] = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const px = parent[x] ?? x;
      if (px === x) return x;
      const ppx = parent[px] ?? px;
      parent[x] = ppx; // path compression (safe assignment)
      x = px;
    }
  }
  function union(x: number, y: number) {
    parent[find(x)] = find(y);
  }
  return { find, union };
}

/* ── main export ─────────────────────────────────────────────────────── */

/**
 * Groups `items` into story clusters.
 * Returns clusters sorted by lead score descending.
 */
export function clusterItems(items: NewsItem[]): StoryCluster[] {
  const n = items.length;
  if (n === 0) return [];

  const tokenSets = items.map((it) => tokenise(it.title));
  const uf = makeUF(n);

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const itI = items[i], itJ = items[j];
      const tsI = tokenSets[i], tsJ = tokenSets[j];
      if (itI && itJ && tsI && tsJ && similarity(itI, itJ, tsI, tsJ) >= THRESHOLD) {
        uf.union(i, j);
      }
    }
  }

  // Group indices by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const existing = groups.get(root);
    if (existing) {
      existing.push(i);
    } else {
      groups.set(root, [i]);
    }
  }

  const clusters: StoryCluster[] = [];
  for (const indices of groups.values()) {
    const clusterItems: NewsItem[] = indices
      .map((i) => items[i])
      .filter((it): it is NewsItem => it !== undefined)
      .sort((a, b) => b.score - a.score);
    const lead = clusterItems[0];
    if (!lead) continue;
    clusters.push({
      id: lead.id,
      lead,
      items: clusterItems,
      size: clusterItems.length,
      category: lead.category,
    });
  }

  return clusters.sort((a, b) => b.lead.score - a.lead.score);
}

/**
 * Finds the cluster containing the item with the given id.
 */
export function getClusterForItem(
  itemId: string,
  clusters: StoryCluster[],
): StoryCluster | null {
  return clusters.find((c) => c.items.some((it) => it.id === itemId)) ?? null;
}

/**
 * Returns the cluster size for an item (1 = standalone story).
 */
export function clusterSizeFor(itemId: string, clusters: StoryCluster[]): number {
  return getClusterForItem(itemId, clusters)?.size ?? 1;
}
