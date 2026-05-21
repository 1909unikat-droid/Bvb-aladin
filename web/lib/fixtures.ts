import "server-only";

export type Competition = "bundesliga" | "champions-league" | "dfb-pokal" | "freundschaft";

export interface Fixture {
  id: number;
  competition: Competition;
  competitionLabel: string;
  matchday?: string;
  dateTime: string; // ISO
  homeTeam: string;
  awayTeam: string;
  isBVBHome: boolean;
  isFinished: boolean;
  score?: { home: number; away: number };
  venue?: string;
}

interface OpenLigaMatch {
  matchID: number;
  matchDateTimeUTC: string;
  group?: { groupName: string };
  team1: { teamId: number; teamName: string; shortName: string };
  team2: { teamId: number; teamName: string; shortName: string };
  matchIsFinished: boolean;
  matchResults?: Array<{ resultTypeID: number; pointsTeam1: number; pointsTeam2: number }>;
}

const BVB_TEAM_ID = 7;

async function fetchBundesliga(): Promise<Fixture[]> {
  try {
    const res = await fetch(
      "https://api.openligadb.de/getmatchdata/bl1/2025",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: OpenLigaMatch[] = await res.json();
    return data
      .filter((m) => m.team1.teamId === BVB_TEAM_ID || m.team2.teamId === BVB_TEAM_ID)
      .map((m) => {
        const isBVBHome = m.team1.teamId === BVB_TEAM_ID;
        const home = isBVBHome ? "BVB" : m.team1.shortName;
        const away = isBVBHome ? m.team2.shortName : "BVB";
        const endResult = m.matchResults?.find((r) => r.resultTypeID === 2);
        return {
          id: m.matchID,
          competition: "bundesliga",
          competitionLabel: "Bundesliga",
          matchday: m.group?.groupName,
          dateTime: m.matchDateTimeUTC,
          homeTeam: home,
          awayTeam: away,
          isBVBHome,
          isFinished: m.matchIsFinished,
          score: endResult
            ? { home: isBVBHome ? endResult.pointsTeam1 : endResult.pointsTeam2,
                away: isBVBHome ? endResult.pointsTeam2 : endResult.pointsTeam1 }
            : undefined,
        };
      });
  } catch {
    return [];
  }
}

// Static CL + Pokal entries for 2025/26 (known/concluded)
const STATIC_FIXTURES: Fixture[] = [
  { id: 9001, competition: "champions-league", competitionLabel: "Champions League", matchday: "Achtelfinale", dateTime: "2026-03-04T21:00:00Z", homeTeam: "BVB", awayTeam: "Sporting CP",  isBVBHome: true,  isFinished: true,  score: { home: 3, away: 0 } },
  { id: 9002, competition: "champions-league", competitionLabel: "Champions League", matchday: "Achtelfinale", dateTime: "2026-03-11T21:00:00Z", homeTeam: "Sporting CP", awayTeam: "BVB", isBVBHome: false, isFinished: true,  score: { home: 0, away: 1 } },
  { id: 9003, competition: "champions-league", competitionLabel: "Champions League", matchday: "Viertelfinale", dateTime: "2026-04-08T21:00:00Z", homeTeam: "BVB", awayTeam: "Atalanta",   isBVBHome: true,  isFinished: true,  score: { home: 1, away: 2 } },
  { id: 9004, competition: "champions-league", competitionLabel: "Champions League", matchday: "Viertelfinale", dateTime: "2026-04-15T21:00:00Z", homeTeam: "Atalanta", awayTeam: "BVB",   isBVBHome: false, isFinished: true,  score: { home: 2, away: 0 } },
  { id: 9101, competition: "dfb-pokal",        competitionLabel: "DFB-Pokal",        matchday: "Viertelfinale", dateTime: "2026-03-18T20:45:00Z", homeTeam: "BVB", awayTeam: "Bayer Leverkusen", isBVBHome: true, isFinished: true, score: { home: 1, away: 2 } },
];

export async function getAllFixtures(): Promise<Fixture[]> {
  const bl = await fetchBundesliga();
  return [...bl, ...STATIC_FIXTURES].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
}

export function getNextFixture(fixtures: Fixture[]): Fixture | null {
  const now = new Date();
  return fixtures.find((f) => !f.isFinished && new Date(f.dateTime) > now) ?? null;
}
