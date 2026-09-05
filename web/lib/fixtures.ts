import "server-only";
import { seasonYear, previousSeasonYear } from "./season";

export type Competition = "bundesliga" | "champions-league" | "dfb-pokal" | "freundschaft";

/** Zusatz zum Endstand bei K.-o.-Spielen: nach Verlängerung / im Elfmeterschießen. */
export type ScoreNote = "n.V." | "i.E.";

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
  scoreNote?: ScoreNote;
  venue?: string;
}

interface OpenLigaResult {
  resultTypeID: number;
  pointsTeam1: number;
  pointsTeam2: number;
}

interface OpenLigaMatch {
  matchID: number;
  matchDateTimeUTC: string;
  group?: { groupName: string };
  team1: { teamId: number; teamName: string; shortName: string };
  team2: { teamId: number; teamName: string; shortName: string };
  matchIsFinished: boolean;
  matchResults?: OpenLigaResult[];
}

const BVB_TEAM_ID = 7;

/**
 * Endstand eines Spiels inklusive Verlängerung und Elfmeterschießen.
 *
 * `resultTypeID` 2 ("Endergebnis") ist bei K.-o.-Spielen nicht verlässlich der
 * Endstand: dfb/2025 führt Frankfurt–BVB (2. Runde) dort als 1:1, obwohl die
 * Partie 3:5 i. E. ausging. Darum gewinnt der höchste vorhandene Ergebnistyp —
 * 5 = Elfmeterschießen, 4 = "Verlängerung" (ucl), 3 = "Nachspielzeit" (dfb,
 * meint ebenfalls nach Verlängerung), 2 = Endergebnis. Die Elfmeter-/
 * Verlängerungs-Werte sind bei OpenLigaDB Gesamtstände, nicht nur die
 * Zusatztore. Bundesliga liefert ausschließlich 1 (Halbzeit) und 2, dort
 * ändert sich also nichts.
 */
function finalResult(
  results: OpenLigaResult[] | undefined
): (OpenLigaResult & { note?: ScoreNote }) | undefined {
  const byType = (id: number) => results?.find((r) => r.resultTypeID === id);
  const penalty = byType(5);
  if (penalty) return { ...penalty, note: "i.E." };
  const extraTime = byType(4) ?? byType(3);
  if (extraTime) return { ...extraTime, note: "n.V." };
  return byType(2);
}

async function fetchBundesligaSeason(year: number): Promise<Fixture[]> {
  try {
    const res = await fetch(
      `https://api.openligadb.de/getmatchdata/bl1/${year}`,
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
        const endResult = finalResult(m.matchResults);
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
            // Wörtliche Heim/Auswärts-Konvention (pointsTeam1 = Heimtore) —
            // wie homeTeam/awayTeam und STATIC_FIXTURES; ScoreBadge verlässt
            // sich darauf (BVB-zentrisches Vertauschen invertierte die Farben).
            ? { home: endResult.pointsTeam1, away: endResult.pointsTeam2 }
            : undefined,
          scoreNote: endResult?.note,
        };
      });
  } catch {
    return [];
  }
}

/**
 * DFB-Pokal der laufenden Saison (OpenLigaDB-Shortcut "dfb", gleiche Team-IDs
 * wie bl1 — BVB ist auch dort ID 7). Failsafe: bei Fehler oder leerer Antwort
 * bleibt der Spielplan einfach ohne Pokal-Termine.
 */
async function fetchPokal(): Promise<Fixture[]> {
  try {
    const res = await fetch(
      `https://api.openligadb.de/getmatchdata/dfb/${seasonYear()}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: OpenLigaMatch[] = await res.json();
    return data
      .filter((m) => m.team1.teamId === BVB_TEAM_ID || m.team2.teamId === BVB_TEAM_ID)
      .map((m) => {
        const isBVBHome = m.team1.teamId === BVB_TEAM_ID;
        const opp = isBVBHome ? m.team2 : m.team1;
        // Amateurvereine haben teils leere shortNames → teamName als Fallback.
        const oppName = opp.shortName || opp.teamName;
        const endResult = finalResult(m.matchResults);
        return {
          id: m.matchID,
          competition: "dfb-pokal",
          competitionLabel: "DFB-Pokal",
          matchday: m.group?.groupName,
          dateTime: m.matchDateTimeUTC,
          homeTeam: isBVBHome ? "BVB" : oppName,
          awayTeam: isBVBHome ? oppName : "BVB",
          isBVBHome,
          isFinished: m.matchIsFinished,
          score: endResult
            // Wörtliche Heim/Auswärts-Konvention (pointsTeam1 = Heimtore) —
            // wie homeTeam/awayTeam und STATIC_FIXTURES; ScoreBadge verlässt
            // sich darauf (BVB-zentrisches Vertauschen invertierte die Farben).
            ? { home: endResult.pointsTeam1, away: endResult.pointsTeam2 }
            : undefined,
          scoreNote: endResult?.note,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Champions League der laufenden Saison (OpenLigaDB-Shortcut "ucl", gleiche
 * Team-IDs wie bl1/dfb — BVB ist auch dort ID 7, verifiziert an ucl/2025).
 * Failsafe: bei Fehler oder leerer Antwort (die Auslosung läuft erst Ende
 * August) bleibt der Spielplan einfach ohne CL-Termine.
 */
async function fetchChampionsLeague(): Promise<Fixture[]> {
  try {
    const res = await fetch(
      `https://api.openligadb.de/getmatchdata/ucl/${seasonYear()}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: OpenLigaMatch[] = await res.json();
    return data
      .filter((m) => m.team1.teamId === BVB_TEAM_ID || m.team2.teamId === BVB_TEAM_ID)
      .map((m) => {
        const isBVBHome = m.team1.teamId === BVB_TEAM_ID;
        const opp = isBVBHome ? m.team2 : m.team1;
        // Auch europäische Gegner haben teils leere shortNames (z. B. FC
        // Kopenhagen, FC Villareal) → teamName als Fallback.
        const oppName = opp.shortName || opp.teamName;
        const endResult = finalResult(m.matchResults);
        return {
          id: m.matchID,
          competition: "champions-league",
          competitionLabel: "Champions League",
          matchday: m.group?.groupName,
          dateTime: m.matchDateTimeUTC,
          homeTeam: isBVBHome ? "BVB" : oppName,
          awayTeam: isBVBHome ? oppName : "BVB",
          isBVBHome,
          isFinished: m.matchIsFinished,
          score: endResult
            // Wörtliche Heim/Auswärts-Konvention (pointsTeam1 = Heimtore) —
            // wie homeTeam/awayTeam und STATIC_FIXTURES; ScoreBadge verlässt
            // sich darauf (BVB-zentrisches Vertauschen invertierte die Farben).
            ? { home: endResult.pointsTeam1, away: endResult.pointsTeam2 }
            : undefined,
          scoreNote: endResult?.note,
        };
      });
  } catch {
    return [];
  }
}

async function fetchBundesliga(): Promise<Fixture[]> {
  // Aktuelle Saison; liefert OpenLigaDB dafür noch nichts (leer/Fehler),
  // Fallback auf die Vorsaison.
  const current = await fetchBundesligaSeason(seasonYear());
  if (current.length > 0) return current;
  return fetchBundesligaSeason(previousSeasonYear());
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
  const [bl, pokal, cl] = await Promise.all([
    fetchBundesliga(),
    fetchPokal(),
    fetchChampionsLeague(),
  ]);
  // Nur statische Einträge im aktuellen Saisonfenster (1.7. bis 30.6.) zeigen —
  // die 2025/26-Einträge laufen so ab Juli 2026 automatisch aus. Bei neuen
  // CL-/Pokal-Terminen der neuen Saison die Liste oben ergänzen.
  const year = seasonYear();
  const seasonStart = new Date(`${year}-07-01T00:00:00Z`);
  const seasonEnd = new Date(`${year + 1}-06-30T23:59:59Z`);
  const staticInSeason = STATIC_FIXTURES.filter((f) => {
    const d = new Date(f.dateTime);
    return d >= seasonStart && d <= seasonEnd;
  });
  return [...bl, ...pokal, ...cl, ...staticInSeason].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
}

export function getNextFixture(fixtures: Fixture[]): Fixture | null {
  const now = new Date();
  return fixtures.find((f) => !f.isFinished && new Date(f.dateTime) > now) ?? null;
}
