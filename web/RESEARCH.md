# BVB-Fanpage — Researcher Findings

**Agent:** researcher (pipeline step 1/8)
**Date:** 2026-05-19
**Data analysed:** `https://bvb-aladin.vercel.app/data/news.json` (build-time snapshot at `/Users/jenssteffen/Claude/Claude neuer Account/bvb-aladin/data/news.json`, `updated_at=2026-05-19T16:44:01Z`)
**Type contract:** [`types/news.ts`](./types/news.ts)

---

## 1. Schema — confirmed against real data

The shape in the master prompt is correct. One field was found on the wire that the spec does **not** mention:

- **`stats`** (top-level, sibling of `items`) — pre-computed aggregate (`total`, `raw_total`, `clusters`, `by_tier`, `by_category`, `sources_ok`, `sources_fail`). Useful for debug overlay / health badge. Typed as optional in `NewsFeed`.

One field documented in the spec was **not present** on the wire:

- **`Confirmation.published`** — the spec example omits it and our snapshot never has it (because no item has confirmation_count > 1). Typed as optional, kept for future clustered items.

All other fields match the master prompt exactly.

---

## 2. Real-world data distribution (n = 101)

### By category (from `feed.stats.by_category`)

| Category    | Count | Share | Route          |
| ----------- | ----: | ----: | -------------- |
| other       | 45    | 44.6% | (drains `/`)   |
| official    | 21    | 20.8% | `/offiziell`   |
| transfers   | 19    | 18.8% | `/transfers`   |
| injury      | 10    |  9.9% | `/verletzungen`|
| matchday    |  5    |  5.0% | `/spieltag`    |
| background  |  1    |  1.0% | `/hintergrund` |

### By kind

| Kind     | Count | Notes                                                 |
| -------- | ----: | ----------------------------------------------------- |
| rss      | 72    | kicker, RUHR24, Ruhr Nachrichten                      |
| x        | 29    | Romano(1), Plettenberg(1), Berger(7), @BVB(20)        |
| youtube  | 0     | **Feed currently has no video items**                 |
| podcast  | 0     | **Feed currently has no podcast items** (podcast-flavoured RSS exists, e.g. "BVB-Podcast 540", but `kind` is `rss`) |

### By tier (top-level only, excludes nested `confirmations[].tier`)

| Tier | Count | Sources observed                                  |
| ---: | ----: | ------------------------------------------------- |
| 1    |  9    | Romano, Plettenberg, Berger                       |
| 2    | 72    | kicker, RUHR24, Ruhr Nachrichten                  |
| 3    | 20    | @BVB / bvb.de                                     |
| 4    |  0    | (none in current snapshot)                        |
| 5    |  0    | (none in current snapshot)                        |

### Source diversity

7 distinct `source_id`s active. Heavy long-tail bias toward `ruhr24_bvb` (43 items, 42.6%). Means the UI MUST handle near-duplicate sources gracefully — visually grouping multiple RUHR24 cards in a row should not look monotonous.

### Score

- Range observed: ~3.72 … 6.57
- Hero-eligible (`score ≥ 6.5`): **2 items** — too few for a 5-slot Ken-Burns carousel.
- Top-5 by score easily covers 5.8+, top-10 covers 5.4+.

### Recency

All items younger than 4 days. 60-min "live dot" tier currently lights up the top ~5 items.

---

## 3. Edge cases observed

| Edge case | Frequency | Mitigation |
| --- | --- | --- |
| Title length > 140 chars | **11 items** (all `kind=x`) — up to ~750 chars where Nitter dumps full tweet body as title | UI MUST `line-clamp-3` headlines; STANDARD-card uses `text-balance`; HERO uses `line-clamp-2` |
| Summary nearly identical to title (URL prettified) | All `kind=x` (29 items) | Use `isRedundantSummary()` helper in `types/news.ts` — when true, render only the title (no teaser block) |
| Emoji in title (🚨, 🎬, ⚫️🟡, 🇩🇪) | ~35 items | Use system emoji font fallback, do NOT strip — they carry semantic weight (e.g. 🚨 = "breaking") |
| Embedded URLs in title body | ~12 items | Strip with `/https?:\S+/g` before display; keep in `summary` for screen readers |
| Non-BVB content slipping through `category=other` | many (E-Auto-Förderung, Sockelleisten-Tricks via RUHR24-RSS) | Route `/` MUST not show items with `components.relevance === 0` above the fold; gate Hero-Card on `components.relevance ≥ 0.5` |
| `published` missing | 0 in current snapshot | Typed as optional; helper `getPublished()` falls back to `feed.updated_at` |
| `confirmation_count` > 1 | 0 in current snapshot | Confirmation modal still must render (forward-compat for cluster output) |
| Tier 4/5 items | 0 in current snapshot | Card-component tier-badge variants must still exist; do **not** code Tier-1/2/3-only branches |
| `kind=youtube` / `kind=podcast` items | 0 in current snapshot | `/videos` and `/podcasts` routes must render the documented empty-state ("Aktuell keine Videos…") rather than crash |
| Score collisions / near-ties | many (multiple items at exactly 5.80) | Secondary sort: `published` DESC. Stable sort or you get UI flicker between fetches |
| HTML entities (`&quot;`, `&amp;`) in summary | rare but seen in kicker | `decodeHtmlEntities()` in `/lib` before render |

---

## 4. Recommended per-route filter strategy

State lives in URL search params (per spec). Filter functions are pure & live in `/lib/filters.ts`.

| Route             | Primary filter                              | Sort                       | Empty-state needed? |
| ----------------- | ------------------------------------------- | -------------------------- | ------------------- |
| `/`               | `components.relevance ≥ 0.33` (drops the RUHR24 lifestyle bleed-through above the fold) — but show all in "Heiß"/Tab "Alle" without filter | `score` DESC, then `published` DESC | yes (build/cold) |
| `/transfers`      | `category === "transfers"`                  | `score` DESC, `published` DESC | **No** — always 15-20 items |
| `/insider`        | `tier === 1`                                | `published` DESC (recency wins over score for insiders) | **Yes** — only 9 items currently, can be empty during quiet hours |
| `/offiziell`      | `category === "official"`                   | `published` DESC           | rare |
| `/spieltag`       | `category === "matchday"`                   | `score` DESC               | possible (only 5 items today) |
| `/verletzungen`   | `category === "injury"`                     | `published` DESC           | possible — copy "gute Nachricht!" already in spec |
| `/videos`         | `kind === "youtube"`                        | `published` DESC           | **Currently always empty** — empty-state CRITICAL |
| `/podcasts`       | `kind === "podcast"`                        | `published` DESC           | **Currently always empty** — empty-state CRITICAL |
| `/stimmen`        | `kind === "x"` (Reddit not in feed yet)     | `score` DESC               | no |
| `/hintergrund`    | `category === "background"`                 | `published` DESC           | **Likely** — only 1 item today |
| `/artikel/[id]`   | `items.find(i => i.id === id)`              | n/a                        | 404-route ("Diese Seite kennt nichtmal Watzke.") |

### Extra filter chips (apply on top of route filter, via URL params)

- `?tier=1` `?tier=2` `?tier=3` — multi-select
- `?since=24h|7d|14d` — wall-clock window from `now()`
- `?q=adeyemi` — fuzzy match on `title + summary + source` (Fuse.js, threshold 0.35, client-only)
- `?kind=x` (etc.) — orthogonal axis, useful on `/transfers` to see insider tweets only

### "Heiß" derived tab on `/`

`items.filter(isHot)` where `isHot = score ≥ 6 && age ≤ 6h`. Currently yields ~6 items. Helper already exported from `types/news.ts`.

### Hero-Card selection (top of `/`)

Hero strip needs ≥ 3 cards minimum to justify a carousel. With only 2 items at `score ≥ 6.5`, the architect should **lower the Hero threshold dynamically**:

```
const hero = items
  .filter(i => i.components.relevance >= 0.5)
  .sort(byScoreThenRecency)
  .slice(0, Math.max(3, items.filter(isHeroCandidate).length));
```

---

## 5. Notes for downstream agents

- **architect:** ISR 60s is fine; the feed itself updates every 30 min server-side. Client-poll every 5 min as spec'd. No need for streaming/WS. `confirmation_count` is always 1 today, but build the modal anyway — the bvb-aladin clustering job is a planned upgrade.
- **ui-designer:** because tier-4/5 cards never appear in current data, the design system MUST still ship those variants (Storybook fixtures included). Tier-1 cards are 9% of feed — the gold-glow-pulse should feel premium, not loud.
- **coder:** prefer server components + `fetch(..., { next: { revalidate: 60 } })`. Build-time snapshot under `/public/data/news.json` for first paint. No CORS issues — feed exposes `Access-Control-Allow-Origin: *`.
- **animator:** Hero carousel needs ≥ 3 slides. Use Hero-fallback selector (see §4) so the strip never collapses.
- **tester:** seed E2E tests with fixtures of (a) 0 YouTube items → empty state, (b) tier-1 breaking news < 5 min old → live-dot + glow, (c) item with 280-char tweet title → ellipsis works, (d) two items at identical score → stable order across refetches.

---

## 6. Open questions for the team

1. Should `/stimmen` include `category=background` AS WELL when no X items are available? (Currently spec-defined as `kind=x` only.)
2. The feed currently has zero `podcast`/`youtube` items, but the bvb-aladin pipeline mentions 13 sources. Should the architect add a build-time guard that pings the feed and warns if `kind=podcast` count = 0 for > 48h (broken upstream parser)?
3. Master prompt says "16-55 Zielgruppe, 10-30min daily" — implies bookmark + read-later are important. localStorage strategy: namespaced under `bvb-hub:v1:*`?

No answers needed before architect can start — these are FYI.
