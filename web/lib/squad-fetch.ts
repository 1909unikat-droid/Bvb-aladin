import "server-only";
import type { SquadDef, Player } from "@/lib/squad-data";

interface TmPlayer {
  id: number;
  tm_id: number;
  name: string;
  number: number;
  positionGroup: string;
  positionShort: string;
  positionDetail: string;
  nationality: string;
  flag: string;
  age: number;
  contract: string;
  marketValue: string | null;
  captain?: boolean;
  onLoan?: boolean;
  loanFrom?: string;
}

interface TmTeam {
  id: string;
  label: string;
  league: string;
  squadValue: string;
  players: TmPlayer[];
}

interface TmSquadJson {
  updated_at: string;
  season: string;
  pending?: boolean;
  teams: TmTeam[];
}

const BASE_URL = "https://bvb-aladin.vercel.app/data";

function squadUrl(season: string) {
  // squad.json = current (2025), squad_2026.json = next season etc.
  return season === "2025" || season === "" ? `${BASE_URL}/squad.json` : `${BASE_URL}/squad_${season}.json`;
}

function mapTeam(t: TmTeam): SquadDef {
  return {
    id: t.id as SquadDef["id"],
    label: t.label,
    league: t.league,
    squadValue: t.squadValue || undefined,
    players: t.players.map(
      (p): Player => ({
        id: p.id,
        tmId: p.tm_id || undefined,
        name: p.name,
        number: p.number,
        positionGroup: p.positionGroup as Player["positionGroup"],
        positionShort: p.positionShort,
        positionDetail: p.positionDetail,
        nationality: p.nationality,
        flag: p.flag,
        age: p.age,
        since: 0,
        contract: p.contract,
        marketValue: p.marketValue ?? undefined,
        captain: p.captain,
        onLoan: p.onLoan,
        loanFrom: p.loanFrom,
      })
    ),
  };
}

export interface SquadResult {
  squads: SquadDef[];
  pending: boolean;
}

export async function fetchSquads(season = "2025"): Promise<SquadResult> {
  const url = squadUrl(season);

  function toResult(data: TmSquadJson): SquadResult | null {
    if (!data.teams?.length) return null;
    return { squads: data.teams.map(mapTeam), pending: data.pending ?? false };
  }

  // Try remote (Vercel deployment of bvb-aladin)
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24h
    if (res.ok) {
      const result = toResult(await res.json());
      if (result) return result;
    }
  } catch {
    // fall through to local
  }

  // Try local bvb-aladin server
  try {
    const localUrl = season === "2025" || season === ""
      ? "http://localhost:8766/data/squad.json"
      : `http://localhost:8766/data/squad_${season}.json`;
    const res = await fetch(localUrl, { next: { revalidate: 3600 } });
    if (res.ok) {
      const result = toResult(await res.json());
      if (result) return result;
    }
  } catch {
    // fall through to local file
  }

  // Fallback: local file shipped with the app
  try {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const fileName = season === "2025" || season === "" ? "squad.json" : `squad_${season}.json`;
    const file = path.join(process.cwd(), "public", "data", fileName);
    const raw = await fs.readFile(file, "utf8");
    const result = toResult(JSON.parse(raw));
    if (result) return result;
  } catch {
    // nothing
  }

  return { squads: [], pending: false };
}
