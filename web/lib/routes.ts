import type { Category, Kind, Tier } from "@/types/news";

export interface NavChild {
  href: string;
  label: string;
}

export interface RouteDef {
  href: string;
  label: string;
  short?: string;
  filter: { category?: Category; kind?: Kind; tier?: Tier };
  children?: NavChild[];
}

export const ROUTES: RouteDef[] = [
  { href: "/", label: "Aktuelles", short: "Aktuelles", filter: {} },
  { href: "/transfers", label: "Transfers", short: "Transfers", filter: { category: "transfers" } },
  { href: "/insider", label: "Insider", short: "Insider", filter: { tier: 1 } },
  { href: "/offiziell", label: "Offiziell", short: "Offiziell", filter: { category: "official" } },
  { href: "/spieltag", label: "Spieltag", short: "Spieltag", filter: { category: "matchday" } },
  { href: "/verletzungen", label: "Verletzungen", short: "Ausfälle", filter: { category: "injury" } },
  {
    href: "/kader",
    label: "Kader",
    short: "Kader",
    filter: {},
    children: [
      { href: "/kader?team=profis",  label: "Profis" },
      { href: "/kader?team=u23",     label: "U23" },
      { href: "/kader?team=u19",     label: "U19" },
      { href: "/kader?team=amateur", label: "Amateur" },
    ],
  },
  { href: "/termine",   label: "Termine",  short: "Termine",  filter: {} },
  { href: "/countdown", label: "Timer",    short: "Timer",    filter: {} },
  { href: "/videos",    label: "Videos",   short: "Videos",   filter: { kind: "youtube" } },
  { href: "/podcasts",  label: "Podcasts", short: "Podcasts", filter: { kind: "podcast" } },
  { href: "/stimmen",   label: "Stimmen",  short: "Stimmen",  filter: { kind: "x" } },
  { href: "/hintergrund", label: "Analyse", short: "Analyse", filter: { category: "background" } },
];

export const MOBILE_NAV = ["/", "/transfers", "/insider", "/spieltag", "/kader", "/termine"] as const;
