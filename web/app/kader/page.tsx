import type { Metadata } from "next";
import { fetchSquads } from "@/lib/squad-fetch";
import { SQUADS } from "@/lib/squad-data";
import { KaderClient } from "./KaderClient";

export const revalidate = 86400; // 24h

export const metadata: Metadata = {
  title: "Kader | BVB Hub",
  description: "Der komplette Kader von Borussia Dortmund — Profis, U23, U19 und Amateur. Marktwerte laut Transfermarkt.",
};

interface Props {
  searchParams: Promise<{ team?: string; season?: string }>;
}

export default async function KaderPage({ searchParams }: Props) {
  const { season = "2025" } = await searchParams;
  const validSeason = ["2025", "2026"].includes(season) ? season : "2025";

  const { squads: liveSquads, pending } = await fetchSquads(validSeason);
  const squads = liveSquads.length > 0 ? liveSquads : SQUADS;

  return <KaderClient squads={squads} season={validSeason} pending={pending} />;
}
