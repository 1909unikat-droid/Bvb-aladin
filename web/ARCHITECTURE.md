# BVB Premium Fanpage — Architecture Blueprint

**Owner:** system-architect
**Date:** 2026-05-19
**Status:** v1.0 — handoff to ui-designer + coder
**Backend dependency:** `bvb-aladin` (read-only consumer of `/data/news.json`)

---

## 0. Scope & Goal

A Next.js 15 App Router fanpage that consumes `news.json` (101 items in the live sample, 7 distinct source IDs, 3 active tiers in current feed but design for full 1–5 range, 2 kinds active `rss|x` but plan for `youtube|podcast`). The architecture must:

1. Server-first render with ISR (60 s) + client-side freshness polling (5 min).
2. Survive offline / API down via a bundled `/public/data/news.json` snapshot + Service Worker cache.
3. Hold zero global client state — URL search params + localStorage only.
4. Stay under 90 KB initial JS gzipped on the home route.
5. Be addressable, sharable, and back-button-correct on every filter combination.

---

## 1. Validated Data Shape

From the live `news.json` sample:

```ts
// /src/types/news.ts  — single source of truth, mirrors bvb-aladin output

export type NewsKind = 'rss' | 'x' | 'youtube' | 'podcast';
export type NewsCategory =
  | 'transfers' | 'injury' | 'matchday'
  | 'official' | 'background' | 'other';
export type NewsTier = 1 | 2 | 3 | 4 | 5;

export interface ScoreComponents {
  credibility: number;   // 0..1
  confirmation: number;  // 0..1
  recency: number;       // 0..1
  specificity: number;   // 0..1
  relevance: number;     // 0..1
}

export interface Confirmation {
  source: string;
  url: string;
  tier: NewsTier;
  published?: string; // ISO; may be absent in current feed
}

export interface NewsItem {
  id: string;                 // 16-hex stable hash
  title: string;
  summary: string;
  url: string;
  published: string;          // ISO 8601 with tz
  source: string;             // display name e.g. "Fabrizio Romano"
  source_id: string;          // slug e.g. "x_romano"
  tier: NewsTier;
  kind: NewsKind;
  score: number;              // 0..10 typically
  category: NewsCategory;
  confirmations: Confirmation[];
  confirmation_count: number;
  components: ScoreComponents;
}

export interface NewsStats {
  total: number;
  raw_total: number;
  clusters: number;
  by_tier: Record<string, number>;
  by_category: Record<string, number>;
  sources_ok: number;
  sources_fail: number;
}

export interface NewsFeed {
  updated_at: string;   // ISO; freshness pivot
  items: NewsItem[];
  stats: NewsStats;
}
```

**Decisions:**
- `kind` and `category` are widened in the type to cover future feeds (`youtube`, `podcast`, `tier 4/5`) even though absent today — UI must render gracefully.
- `published` on a confirmation is optional (not present today) — Modal must tolerate `undefined`.
- All ISO timestamps parsed once via `new Date(...)` at the fetcher boundary; downstream uses `Date` objects.

---

## 2. Route Table (App Router)

| Route | Segment | Render | Filter (server-applied) | Notes |
|---|---|---|---|---|
| `/` | `app/(site)/page.tsx` | ISR 60 s + client poll | none — full sorted feed | Hero + HotStrip + HeroCards + NewsGrid |
| `/transfers` | `app/(site)/transfers/page.tsx` | ISR 60 s | `category === 'transfers'` | |
| `/insider` | `app/(site)/insider/page.tsx` | ISR 60 s | `tier === 1` | Glow-pulse styling |
| `/offiziell` | `app/(site)/offiziell/page.tsx` | ISR 60 s | `category === 'official'` | |
| `/spieltag` | `app/(site)/spieltag/page.tsx` | ISR 60 s | `category === 'matchday'` | OpenLigaDB widget enabled |
| `/verletzungen` | `app/(site)/verletzungen/page.tsx` | ISR 60 s | `category === 'injury'` | Empty-state copy: "gute Nachricht!" |
| `/videos` | `app/(site)/videos/page.tsx` | ISR 60 s | `kind === 'youtube'` | Lazy YouTube embed |
| `/podcasts` | `app/(site)/podcasts/page.tsx` | ISR 60 s | `kind === 'podcast'` | Sticky `<PodcastPlayer/>` |
| `/stimmen` | `app/(site)/stimmen/page.tsx` | ISR 60 s | `kind === 'x'` (+ future `reddit`) | Compact horizontal cards |
| `/hintergrund` | `app/(site)/hintergrund/page.tsx` | ISR 60 s | `category === 'background'` | |
| `/artikel/[id]` | `app/(site)/artikel/[id]/page.tsx` | ISR 60 s + `generateStaticParams` (top 50 by score) | item by id | Read-progress bar, source list |
| `/impressum` | `app/(site)/impressum/page.tsx` | Static | — | Placeholder copy |
| `/datenschutz` | `app/(site)/datenschutz/page.tsx` | Static | — | Placeholder copy |
| `/sitemap.xml` | `app/sitemap.ts` | Static | — | All routes + top 50 articles |
| `/robots.txt` | `app/robots.ts` | Static | allow all | |
| `/manifest.json` | `app/manifest.ts` | Static | PWA manifest | |
| `/opengraph-image` | `app/opengraph-image.tsx` | Edge | `@vercel/og` | Default OG |
| `/artikel/[id]/opengraph-image` | route-scoped | Edge | dynamic title | Per-article OG |

**No parallel routes needed.** The Podcast player persistence is solved with a top-level `<PersistentPodcastPlayer/>` mounted in the root layout (client component, reads from a `usePodcastQueue` hook backed by localStorage + a Zustand-free module-scoped `useSyncExternalStore` — see §5).

**Route group `(site)`** hosts everything that shares the chrome (sticky-nav, bottom-nav, footer). Special routes (`opengraph-image`, sitemap, robots, manifest) live outside it.

---

## 3. File Tree

```
bvb-fanpage/
├── public/
│   ├── data/
│   │   └── news.json                 # build-time snapshot, copied from bvb-aladin
│   ├── icons/                        # 192/512/maskable PWA icons
│   ├── fonts/                        # if any self-hosted; prefer next/font
│   └── og-fallback.png
├── src/
│   ├── app/
│   │   ├── layout.tsx                # root, fonts, metadata defaults, <NewsRefreshProvider>
│   │   ├── globals.css               # Tailwind v4 + tokens
│   │   ├── error.tsx                 # root error boundary
│   │   ├── not-found.tsx             # "Diese Seite kennt nichtmal Watzke."
│   │   ├── manifest.ts
│   │   ├── robots.ts
│   │   ├── sitemap.ts
│   │   ├── opengraph-image.tsx
│   │   └── (site)/
│   │       ├── layout.tsx            # StickyNav + BottomNav + PersistentPodcastPlayer
│   │       ├── page.tsx              # /
│   │       ├── _components/          # route-group-private UI
│   │       │   ├── HeroSection.tsx
│   │       │   ├── HotStrip.tsx
│   │       │   ├── NewsGrid.tsx
│   │       │   ├── FilterBar.tsx
│   │       │   └── EmptyState.tsx
│   │       ├── transfers/page.tsx
│   │       ├── insider/page.tsx
│   │       ├── offiziell/page.tsx
│   │       ├── spieltag/page.tsx
│   │       ├── verletzungen/page.tsx
│   │       ├── videos/page.tsx
│   │       ├── podcasts/page.tsx
│   │       ├── stimmen/page.tsx
│   │       ├── hintergrund/page.tsx
│   │       ├── impressum/page.tsx
│   │       ├── datenschutz/page.tsx
│   │       └── artikel/[id]/
│   │           ├── page.tsx
│   │           ├── opengraph-image.tsx
│   │           └── _components/
│   │               ├── ReadProgressBar.tsx
│   │               └── SourceList.tsx
│   ├── components/                   # shared, cross-route
│   │   ├── nav/
│   │   │   ├── StickyNav.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   └── NavPill.tsx           # uses framer layoutId
│   │   ├── cards/
│   │   │   ├── Card.tsx              # discriminated union variant
│   │   │   ├── HeroCard.tsx
│   │   │   ├── StandardCard.tsx
│   │   │   ├── CompactCard.tsx
│   │   │   └── index.ts
│   │   ├── badges/
│   │   │   ├── TierBadge.tsx
│   │   │   ├── ConfirmationBadge.tsx
│   │   │   └── LiveDot.tsx
│   │   ├── score/
│   │   │   └── ScoreBar.tsx          # 5-segment animated
│   │   ├── modals/
│   │   │   └── SourcesModal.tsx
│   │   ├── player/
│   │   │   ├── PersistentPodcastPlayer.tsx
│   │   │   └── usePodcastQueue.ts
│   │   ├── youtube/
│   │   │   └── LazyYouTube.tsx       # custom thumbnail, click to load iframe
│   │   ├── search/
│   │   │   └── SearchBox.tsx         # Fuse.js client only
│   │   ├── share/
│   │   │   └── ShareButton.tsx
│   │   ├── livescore/
│   │   │   ├── LiveScoreSlot.tsx     # server component
│   │   │   └── livescore.ts          # OpenLigaDB fetch
│   │   ├── toast/
│   │   │   ├── ToastHost.tsx
│   │   │   └── useToast.ts
│   │   ├── feedback/
│   │   │   ├── Skeleton.tsx          # animated yellow/black stripes
│   │   │   └── CurtainReveal.tsx
│   │   └── pwa/
│   │       └── InstallPrompt.tsx
│   ├── lib/
│   │   ├── news/
│   │   │   ├── fetchNews.ts          # server-side primary+fallback
│   │   │   ├── filter.ts             # category/tier/kind/since/q filters
│   │   │   ├── sort.ts               # score-desc + recency tiebreak
│   │   │   ├── derive.ts             # isHot, isFresh, readingTime
│   │   │   └── search.ts             # Fuse index builder (client)
│   │   ├── url/
│   │   │   └── searchParams.ts       # typed parse/stringify
│   │   ├── time/
│   │   │   └── format.ts             # relative + absolute, de-DE
│   │   ├── storage/
│   │   │   ├── bookmarks.ts          # localStorage CRUD + useSyncExternalStore
│   │   │   └── readState.ts          # same pattern
│   │   ├── pwa/
│   │   │   └── register-sw.ts
│   │   └── analytics/
│   │       └── noop.ts               # default-off
│   ├── hooks/
│   │   ├── useNewsRefresh.ts         # 5-min poll, toast on newer updated_at
│   │   ├── useBookmarks.ts
│   │   ├── useReadState.ts
│   │   ├── usePrefersReducedMotion.ts
│   │   ├── useHaptic.ts              # navigator.vibrate(10)
│   │   └── useSwipeNav.ts            # framer-motion drag → router.push
│   ├── types/
│   │   ├── news.ts
│   │   └── livescore.ts
│   └── styles/
│       └── tokens.css                # design tokens (also exported to tailwind.config.ts)
├── public/sw.js                      # Workbox-generated at build
├── tailwind.config.ts
├── tsconfig.json                     # strict, exactOptionalPropertyTypes
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── .prettierrc
├── package.json
└── vercel.json
```

**Conventions:**
- `_components/` (underscore) = route-scoped, not routed.
- `components/` = shared across routes.
- Hooks co-located when single-use, else in `/src/hooks`.
- One component per file, PascalCase, max ~200 lines.

---

## 4. Data Flow

### 4.1 ASCII Diagram

```
                  ┌────────────────────────────────────────────────┐
                  │  bvb-aladin GitHub Action (every 30 min)       │
                  │  publishes → https://bvb-aladin.vercel.app/    │
                  │                  data/news.json                │
                  └───────────────┬────────────────────────────────┘
                                  │
              ┌───────────────────┴────────────────────┐
              │                                        │
              ▼                                        ▼
   ┌──────────────────────┐                  ┌─────────────────────┐
   │ Build-time snapshot  │                  │  Runtime ISR fetch  │
   │ scripts/sync-snap.ts │                  │  Server Component   │
   │ → /public/data/      │                  │  fetchNews()        │
   │     news.json        │                  │  revalidate=60      │
   └──────────┬───────────┘                  └──────────┬──────────┘
              │                                         │
              │ (offline / fetch-fail fallback)         │
              └─────────────────────┬───────────────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │  parsed NewsFeed       │
                       │  (lib/news/fetchNews)  │
                       └────────────┬───────────┘
                                    │ filter(searchParams) + sort
                                    ▼
                       ┌────────────────────────┐
                       │  Page Server Component │
                       │  renders HTML + JSON   │
                       │  payload to client     │
                       └────────────┬───────────┘
                                    │ hydrate
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │  Client                                                │
       │  ┌──────────────────────┐   ┌───────────────────────┐  │
       │  │ useNewsRefresh()     │   │ Service Worker        │  │
       │  │  setInterval 5 min   │   │  SWR cache news.json  │  │
       │  │  HEAD/GET updated_at │   │  + image cache-first  │  │
       │  │  → toast if newer    │   └───────────────────────┘  │
       │  └──────────────────────┘                              │
       │  ┌──────────────────────┐   ┌───────────────────────┐  │
       │  │ URL searchParams     │   │ localStorage          │  │
       │  │  ?tier=1&q=&since=24h│   │  bookmarks, readState │  │
       │  │  (router.replace)    │   │  useSyncExternalStore │  │
       │  └──────────────────────┘   └───────────────────────┘  │
       └────────────────────────────────────────────────────────┘
```

### 4.2 `fetchNews()` Strategy (server)

```ts
// src/lib/news/fetchNews.ts (pseudo-signature, full impl by coder)
export async function fetchNews(): Promise<NewsFeed> {
  // 1. Try primary with Next fetch cache
  try {
    const res = await fetch(PRIMARY_URL, {
      next: { revalidate: 60, tags: ['news'] },
      // 4 s budget — we still want to render
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return validate(await res.json());
  } catch { /* swallow, fall through */ }

  // 2. Bundled snapshot
  const snap = await import('../../../public/data/news.json', { with: { type: 'json' } });
  return validate(snap.default as unknown);
}
```

- `validate()` does a shape check (Zod schema mirroring §1). Bad fields are dropped per-item, never thrown — degrade gracefully.
- `revalidate: 60` is set per fetch (App Router pattern); pages do NOT export `export const revalidate`. This keeps the snapshot import path cache-stable.
- `unstable_cache` not used — Next 15's native fetch cache is enough.

### 4.3 Client polling — `useNewsRefresh`

```ts
// 1. Reads server-rendered `updated_at` from a hidden meta tag (no JS payload).
// 2. setInterval 5 min → fetch(PRIMARY_URL, { cache: 'no-store' })
// 3. If newer: useToast() shows "Neue News verfügbar — Refresh" CTA.
// 4. Refresh CTA → router.refresh() (RSC re-fetch, preserves scroll + filters).
// 5. On visibilitychange=visible, do an immediate check (debounced 30 s).
// 6. On offline event → silent suspend; on online → resume + immediate check.
```

### 4.4 Error / Offline Strategy

| Condition | Behavior |
|---|---|
| Primary fetch 5xx | Bundled snapshot → render, no toast |
| Primary fetch network error | Bundled snapshot → render, no toast |
| Client poll fails | Silent retry next interval |
| Browser goes offline | Toast (bottom): "Verbindung verloren – zeige gecachte News (Stand HH:mm)" |
| Item missing required fields | Dropped by validator, logged dev-only |
| Empty filtered result | `<EmptyState/>` with category-specific copy |
| `/artikel/[id]` id not found | `notFound()` → `not-found.tsx` ("Watzke") |

---

## 5. State Strategy

**Three buckets — no Redux, no Zustand, no Jotai.**

### 5.1 Server state → URL search params

| Param | Type | Pages | Default |
|---|---|---|---|
| `tier` | `1\|2\|3\|4\|5` (csv allowed) | all | undefined (= all) |
| `kind` | `rss\|x\|youtube\|podcast` (csv) | all | undefined |
| `cat` | `transfers\|injury\|...` (csv) | not on category-fixed pages | undefined |
| `q` | string (1–80 chars) | all | undefined |
| `since` | `6h\|24h\|7d\|14d` | all | undefined (= all) |
| `sort` | `score\|recent` | all | `score` |
| `hot` | `1` | `/` | undefined |

- Single source of truth: `src/lib/url/searchParams.ts` — typed parse + stringify, used by Server Components (to filter) AND client filter UI (to push).
- Client filter changes use `router.replace(...)` (NOT `push`) to avoid history spam, except when user explicitly opens a new tab/category.
- Server Components read `searchParams` prop, run `lib/news/filter.ts`.

### 5.2 Local UI state → React only

- `useState` / `useReducer` inside leaf components.
- No context for filters — they live in URL.

### 5.3 Persistent client state → `localStorage` + `useSyncExternalStore`

Two stores: `bookmarks` (Set\<id\>) and `readState` (Map\<id, timestamp\>).

```ts
// Pattern (lib/storage/bookmarks.ts):
//   const store = createStorageStore<Set<string>>('bvb.bookmarks', new Set());
//   export const useBookmarks = () => useSyncExternalStore(store.sub, store.get, store.getServer);
//   store.toggle(id) — emits to all subscribers, writes to localStorage.
// Why useSyncExternalStore: avoids hydration mismatch, works across tabs (storage event).
```

- Read state opacity (0.6) is applied via a `data-read` attribute on the card → CSS handles the visual, no re-render storm.
- Podcast queue follows the same store pattern (`usePodcastQueue`).

### 5.4 Ephemeral cross-tree state → tiny pub-sub

For Toast (`useToast`) and Modal (`SourcesModal`) we use a module-scoped event emitter + `useSyncExternalStore`. No Provider tree pollution.

---

## 6. Component Hierarchy

```
RootLayout                                   (app/layout.tsx)
├── <html lang="de">
├── <body class="bg-bvb-black text-white">
│   ├── <NewsRefreshMeta updated_at={...}/>  hidden meta for client poll
│   ├── <CurtainReveal/>                     300ms, suspends children
│   ├── (site) layout                        (app/(site)/layout.tsx)
│   │   ├── <StickyNav/>                     desktop, shrinks on scroll
│   │   │   └── <NavPill/> × N               framer layoutId="navPill"
│   │   ├── <BottomNav/>                     mobile, 4 items + "Mehr"
│   │   ├── {children}                       route page
│   │   ├── <PersistentPodcastPlayer/>       client, mounted always
│   │   ├── <ToastHost/>                     portal target
│   │   ├── <SourcesModal/>                  portal target
│   │   └── <Footer/>                        credits + legal
│   └── <ServiceWorkerRegister/>             effect-only, no DOM
│
└── Home page (/)
    ├── <HeroSection/>                       server
    │   ├── <StadiumParallax/>               client, GSAP ScrollTrigger pin
    │   ├── <LiveScoreSlot/>                 server, OpenLigaDB
    │   └── <TopStoryCarousel/>              client, Ken-Burns
    ├── <HotStrip/>                          score≥6 && <6h, horizontal scroll
    ├── <FilterBar/>                         client, writes URL
    │   ├── <FilterChips kind="tier"/>
    │   ├── <FilterChips kind="source"/>
    │   ├── <FilterChips kind="since"/>
    │   └── <SearchBox/>                     Fuse.js, client-only
    ├── <NewsGrid items={filtered}/>         server
    │   ├── <HeroCard/>      ┐
    │   ├── <StandardCard/>  │  discriminated by score + position
    │   └── <CompactCard/>   ┘
    │       ├── <TierBadge tier=.../>
    │       ├── <ScoreBar score=. components=.../>
    │       ├── <ConfirmationBadge count=. onClick=open modal/>
    │       ├── <LiveDot/>                   if published<60 min
    │       └── <BookmarkButton id=.../>
    └── <Skeleton/>                          Suspense fallback
```

**Server vs. Client component split:**

| Component | Boundary | Reason |
|---|---|---|
| Page, Hero static parts, NewsGrid container, Cards | Server | Streamed HTML, zero JS |
| StickyNav (scroll listener), BottomNav | Client | scroll + interaction |
| StadiumParallax, TopStoryCarousel | Client | GSAP ScrollTrigger |
| FilterBar, SearchBox, FilterChips | Client | writes URL |
| ScoreBar | Client | enter-animation |
| BookmarkButton, ShareButton | Client | localStorage + Web Share API |
| PersistentPodcastPlayer | Client | audio element survives navigation only if rendered in layout |
| LiveScoreSlot | Server | OpenLigaDB fetched on the server, no client API key |
| LazyYouTube | Client | click-to-load iframe |
| SourcesModal, ToastHost | Client | portal + sub |
| ReadProgressBar | Client | scrollY |

**Card variant decision (in NewsGrid):**

```
position 0 AND score > 6.5  → HeroCard
kind in {x, podcast}        → CompactCard
else                        → StandardCard
```

This rule is centralized in `src/lib/news/derive.ts::pickVariant(item, position)` so card mix stays consistent across routes.

---

## 7. Live-Score Widget

- `LiveScoreSlot` is a Server Component, fetched with `next: { revalidate: 60 }`.
- During a live match (kickoff ≤ now ≤ kickoff + 130 min), a client child component starts a 60 s poll using `useSWR`-style logic (custom, no swr dep) — only mounted in that window.
- Season + matchday derivation: pure helper in `livescore.ts` using current date (Bundesliga calendar heuristic, fallback to "next 7d window").
- Fail-soft: any non-200 → component returns `null`. No skeleton, no error text.

---

## 8. PWA

- `next-pwa` excluded — too opinionated for App Router. Instead: hand-written `sw.js` registered by `lib/pwa/register-sw.ts` after window load.
- Strategies:
  - App shell (HTML + JS chunks): `CacheFirst` with revalidate on visibility.
  - `news.json`: `StaleWhileRevalidate`, max-age 60 s.
  - Images (`/_next/image`): `CacheFirst`, max-age 7 d, max-entries 200.
- `manifest.ts` exports the manifest at `/manifest.webmanifest`.
- Install prompt deferred to 2nd visit using a localStorage counter.

---

## 9. SEO

- `app/layout.tsx` exports `metadata` with site-wide defaults (title template, OG defaults, theme-color #000).
- Each route exports `generateMetadata` if dynamic (e.g., `/artikel/[id]` uses item title + summary).
- `app/opengraph-image.tsx` (edge runtime) generates default OG; `/artikel/[id]/opengraph-image.tsx` generates per-article.
- Sitemap includes top 50 articles by score (limit to keep below 50k URL cap and OG generation budget).
- JSON-LD injected in `/artikel/[id]/page.tsx` (NewsArticle + BreadcrumbList).

---

## 10. Performance Budget Mapping

| Target | Mechanism |
|---|---|
| LCP < 1.5 s | Server-rendered Hero with `next/image` priority + AVIF, hero font preloaded via `next/font` |
| CLS < 0.05 | Fixed Hero height (`min-h-[60vh]`), reserved skeleton dimensions, no late-injected ads |
| INP < 100 ms | Animations on transform/opacity only; FilterChips debounced 120 ms; `useDeferredValue` for search results |
| Initial JS < 90 KB | Server-first; Framer Motion + GSAP code-split by route (dynamic import); shadcn imports tree-shaken; Fuse loaded only when SearchBox opens |
| Lighthouse 95+ | No render-blocking CSS (Tailwind v4 native), no client analytics by default, font-display swap |

---

## 11. Accessibility

- `usePrefersReducedMotion()` short-circuits Framer Motion variants to `{ transition: { duration: 0 } }` and disables GSAP ScrollTrigger pin.
- Curtain reveal becomes a 150 ms fade.
- All cards are `<article>`; navigation `<nav aria-label>`; modals trap focus (Radix `Dialog` from shadcn).
- Tier badge text always present (not icon-only).

---

## 12. Key Decisions & Tradeoffs (mini-ADRs)

### ADR-001 — App Router, Server-First
**Decision:** Use App Router with Server Components for all data-bound rendering; Client Components only for interactivity.
**Tradeoff:** Slightly more upfront discipline (server/client boundary) vs. ~40 % smaller initial JS, free streaming, free ISR.
**Risk:** Some shadcn primitives are client-only — fine, but means every modal/dropdown crosses the boundary.

### ADR-002 — No client state library
**Decision:** URL search params + `useSyncExternalStore` over localStorage.
**Tradeoff:** Slightly more boilerplate per persisted store vs. zero bundle cost and SSR-safe, multi-tab-safe out of the box.
**Risk:** Devs unfamiliar with `useSyncExternalStore` — mitigated by one helper `createStorageStore` used everywhere.

### ADR-003 — ISR 60 s + 5 min client poll (not WebSocket)
**Decision:** Static HTML refreshed every 60 s on the edge + lightweight client poll.
**Tradeoff:** Up to ~60 s server staleness vs. zero server infra, zero auth, free Vercel ISR.
**Risk:** During live matchdays users may want faster updates — mitigated by the LiveScoreSlot which polls 60 s on its own, and the in-app refresh toast.

### ADR-004 — Bundled snapshot fallback in `/public/data/news.json`
**Decision:** Ship a build-time snapshot; never fail a render.
**Tradeoff:** ~110 KB in the build vs. permanent uptime even if bvb-aladin is down.
**Risk:** Snapshot can become stale during long bvb-aladin outage — acceptable (better than blank page); a "snapshot mode" toast is shown.

### ADR-005 — Framer Motion + GSAP both
**Decision:** Framer for layout/UI animations (declarative, integrated with React), GSAP only for ScrollTrigger Hero parallax + Flip page transitions.
**Tradeoff:** Two animation libs (~+25 KB) vs. each one used where it excels.
**Mitigation:** GSAP imported dynamically on routes that need it (`/` Hero, page transitions only).

### ADR-006 — Tailwind v4 + shadcn/ui
**Decision:** Tailwind v4 (native CSS-first config), shadcn primitives copy-pasted into `src/components/ui` for control.
**Tradeoff:** Tailwind v4 is newer (Jan 2025), tooling slightly less mature vs. faster builds, no PostCSS plugin, native CSS variables.

### ADR-007 — `category=other` is 45 % of feed — don't show it as a top tab
**Decision:** No `/sonstiges` route. `other` items appear on `/` only.
**Rationale:** Avoid noise tab; insiders/transfers/official tabs are the high-signal entries the user wants.

### ADR-008 — Live source set is currently 13 (`sources_ok`); 7 active source_ids in sample
**Decision:** Filter UI lists sources dynamically from the loaded feed (not hardcoded).
**Rationale:** New sources may be added by bvb-aladin without redeploy.

### ADR-009 — Fuse.js client-only, lazy-loaded
**Decision:** No server-side search. Fuse loaded on `SearchBox` open.
**Tradeoff:** First search has ~80 ms init delay vs. 0 server cost and instant subsequent queries.

### ADR-010 — Confirmation `published` may be missing
**Decision:** SourcesModal renders "—" when absent; sort by published asc with `Infinity` for undefined.

---

## 13. Dependencies (exact versions for package.json)

```json
{
  "name": "bvb-fanpage",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "sync-snapshot": "tsx scripts/sync-snapshot.ts"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "framer-motion": "12.0.6",
    "gsap": "3.12.7",
    "@gsap/react": "2.1.2",
    "lucide-react": "0.474.0",
    "fuse.js": "7.0.0",
    "zod": "3.24.1",
    "clsx": "2.1.1",
    "tailwind-merge": "2.6.0",
    "class-variance-authority": "0.7.1",
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-tooltip": "1.1.6",
    "@radix-ui/react-slot": "1.1.1",
    "@vercel/og": "0.6.4"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "@types/node": "22.10.7",
    "@types/react": "19.0.7",
    "@types/react-dom": "19.0.3",
    "tailwindcss": "4.0.0",
    "@tailwindcss/postcss": "4.0.0",
    "postcss": "8.5.1",
    "autoprefixer": "10.4.20",
    "eslint": "9.18.0",
    "eslint-config-next": "15.1.6",
    "@typescript-eslint/eslint-plugin": "8.20.0",
    "@typescript-eslint/parser": "8.20.0",
    "prettier": "3.4.2",
    "prettier-plugin-tailwindcss": "0.6.10",
    "husky": "9.1.7",
    "lint-staged": "15.4.1",
    "tsx": "4.19.2",
    "@playwright/test": "1.49.1",
    "@axe-core/playwright": "4.10.1"
  }
}
```

**Notes for coder:**
- `next-pwa` deliberately omitted — see §8.
- No state lib (Redux/Zustand/Jotai) — see ADR-002.
- No date-fns/dayjs — `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat('de-DE')` are enough; ~0 KB cost.
- shadcn primitives are copied in via CLI, not as a package — no `shadcn-ui` in deps.

---

## 14. Tailwind Tokens (handoff to ui-designer)

```ts
// tailwind.config.ts excerpt — ui-designer extends
extend: {
  colors: {
    bvb: {
      yellow: '#FDE100',
      black:  '#000000',
      asphalt:'#111111',
      glow:   'rgba(253,225,0,0.35)',
    },
    tier: {
      1: '#FFD700', // insider gold
      2: '#FDE100',
      3: '#FFFFFF', // official
      4: '#9CA3AF',
      5: '#6B7280',
    },
  },
  fontFamily: {
    display: ['var(--font-display)', 'Impact', 'sans-serif'],
    sans:    ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
  },
  boxShadow: {
    'glow-y':       '0 0 24px rgba(253,225,0,0.35)',
    'glow-y-strong':'0 0 48px rgba(253,225,0,0.55)',
  },
  backgroundImage: {
    'stripes-yellow': 'repeating-linear-gradient(135deg, #FDE100 0 8px, transparent 8px 24px)',
    'noise':          'url(/noise.svg)',
  },
}
```

---

## 15. Handoff Notes

### For ui-designer
- Use tokens in §14, expand into `globals.css` (Tailwind v4 native CSS-config) and per-component variants via CVA.
- Card variants in §6; produce `HeroCard`, `StandardCard`, `CompactCard` first — `NewsGrid` is the integration point.
- Tier-1 cards need the glow-pulse border animation (Framer keyframes preferred).
- All loading states use `<Skeleton/>` (yellow-black stripes), never spinners.
- Bottom-nav on mobile must not overlap the persistent podcast player — coordinate z-index: player above nav, nav slides down when player is open.

### For coder
- Start with: `src/types/news.ts`, `src/lib/news/{fetchNews,filter,sort,derive}.ts`, `src/lib/url/searchParams.ts`, then `app/layout.tsx` + `app/(site)/layout.tsx` + `app/(site)/page.tsx`.
- Snapshot sync: a small `scripts/sync-snapshot.ts` (run pre-build) copies bvb-aladin's `data/news.json` into `/public/data/news.json`. Do not commit a stale snapshot.
- Use `searchParams` prop in pages (not `useSearchParams`) for the server-side filter; client filter components push to URL.
- Add `experimental: { reactCompiler: true }` in `next.config.ts` only if it builds cleanly — otherwise defer.
- Don't reach across the architecture: keep `lib/news/*` framework-agnostic (no `next/*` imports) so it stays unit-testable.
```
