# BVB Hub

Premium fan-aggregator for Borussia Dortmund — consumes the static news feed
from [bvb-aladin](../bvb-aladin/) and renders it in a Schwarz-Gelb UI with
Framer-Motion animations.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (`@theme` tokens) — see `app/globals.css`
- Framer Motion 11 (nav-pill morph, scroll reveals, score bars)
- No backend, no DB, no auth — pure SSG/ISR with a 60 s revalidate window

## Datenfluss

```
bvb-aladin (GH Actions, alle 30 min)
        │  writes data/news.json
        ▼
https://bvb-aladin.vercel.app/data/news.json   ← live feed (CORS *)
        │
        ├─ Server: lib/news-server.ts  (revalidate=60)
        └─ Client: lib/news-client.ts  (no-store)
                                │
                                └─ Fallback: /public/data/news.json
                                   (refreshed via `npm run snapshot`)
```

## Scripts

```
npm run dev        # Dev server :8767
npm run build      # Production build
npm run start      # Production server :8767
npm run typecheck  # tsc --noEmit
npm run snapshot   # Refresh /public/data/news.json snapshot
```

## Routen

| Route | Filter |
|---|---|
| `/` | sortiert nach `score` |
| `/transfers` | `category=transfers` |
| `/insider` | `tier=1` |
| `/offiziell` | `category=official` |
| `/spieltag` | `category=matchday` |
| `/verletzungen` | `category=injury` |
| `/videos` | `kind=youtube` |
| `/podcasts` | `kind=podcast` |
| `/stimmen` | `kind=x` |
| `/hintergrund` | `category=background` |

## Hinweise

Privates Fan-Projekt — keine offizielle Borussia-Dortmund-Seite. Verzichtet
auf Tracking, Cookies und externe Logos (Markenrecht).
