export type PositionGroup = "Tor" | "Abwehr" | "Mittelfeld" | "Angriff";
export type TeamId = "profis" | "u23" | "u19" | "amateur";

export interface Player {
  id: number;
  tmId?: number;        // Transfermarkt Spieler-ID
  name: string;
  number: number;
  positionGroup: PositionGroup;
  positionShort: string;
  positionDetail?: string;
  nationality: string;
  flag: string;
  age: number;
  since: number;
  contract: string;
  marketValue?: string;
  onLoan?: boolean;
  loanFrom?: string;
  captain?: boolean;
}

export interface SquadDef {
  id: TeamId;
  label: string;
  league: string;
  squadValue?: string; // live from TM
  players: Player[];
}

// ── Profis ───────────────────────────────────────────────────────────────────
const PROFIS: Player[] = [
  // Tor
  { id: 1,  name: "Gregor Kobel",       number: 1,  positionGroup: "Tor",       positionShort: "TW",  nationality: "CH", flag: "🇨🇭", age: 27, since: 2021, contract: "2026", marketValue: "35 Mio. €" },
  { id: 2,  name: "Marcel Lotka",       number: 35, positionGroup: "Tor",       positionShort: "TW",  nationality: "DE", flag: "🇩🇪", age: 23, since: 2022, contract: "2027" },
  { id: 3,  name: "Alexander Meyer",    number: 25, positionGroup: "Tor",       positionShort: "TW",  nationality: "DE", flag: "🇩🇪", age: 32, since: 2023, contract: "2026" },
  // Abwehr
  { id: 4,  name: "Nico Schlotterbeck", number: 4,  positionGroup: "Abwehr",    positionShort: "IV",  nationality: "DE", flag: "🇩🇪", age: 25, since: 2022, contract: "2027", marketValue: "55 Mio. €" },
  { id: 5,  name: "Waldemar Anton",     number: 5,  positionGroup: "Abwehr",    positionShort: "IV",  nationality: "DE", flag: "🇩🇪", age: 28, since: 2024, contract: "2028", marketValue: "25 Mio. €" },
  { id: 6,  name: "Julian Ryerson",     number: 13, positionGroup: "Abwehr",    positionShort: "RV",  nationality: "NO", flag: "🇳🇴", age: 27, since: 2022, contract: "2026", marketValue: "15 Mio. €" },
  { id: 7,  name: "Ian Maatsen",        number: 18, positionGroup: "Abwehr",    positionShort: "LV",  nationality: "NL", flag: "🇳🇱", age: 23, since: 2023, contract: "2029", marketValue: "40 Mio. €" },
  { id: 8,  name: "Ramy Bensebaini",    number: 22, positionGroup: "Abwehr",    positionShort: "LV",  nationality: "DZ", flag: "🇩🇿", age: 29, since: 2023, contract: "2027", marketValue: "12 Mio. €" },
  { id: 9,  name: "Tom Rothe",          number: 38, positionGroup: "Abwehr",    positionShort: "LV",  nationality: "DE", flag: "🇩🇪", age: 20, since: 2020, contract: "2027" },
  // Mittelfeld
  { id: 10, name: "Emre Can",           number: 23, positionGroup: "Mittelfeld", positionShort: "DM", nationality: "DE", flag: "🇩🇪", age: 31, since: 2020, contract: "2026", captain: true, marketValue: "12 Mio. €" },
  { id: 11, name: "Felix Nmecha",       number: 28, positionGroup: "Mittelfeld", positionShort: "ZM", nationality: "DE", flag: "🇩🇪", age: 24, since: 2023, contract: "2028", marketValue: "30 Mio. €" },
  { id: 12, name: "Marcel Sabitzer",    number: 19, positionGroup: "Mittelfeld", positionShort: "ZM", nationality: "AT", flag: "🇦🇹", age: 31, since: 2024, contract: "2027", marketValue: "18 Mio. €" },
  { id: 13, name: "Pascal Groß",        number: 15, positionGroup: "Mittelfeld", positionShort: "ZM", nationality: "DE", flag: "🇩🇪", age: 34, since: 2024, contract: "2026", marketValue: "6 Mio. €" },
  { id: 14, name: "Joan Gadou",         number: 44, positionGroup: "Mittelfeld", positionShort: "OM", nationality: "DE", flag: "🇩🇪", age: 20, since: 2025, contract: "2029", marketValue: "15 Mio. €" },
  // Angriff
  { id: 15, name: "Karim Adeyemi",      number: 27, positionGroup: "Angriff",   positionShort: "LA",  nationality: "DE", flag: "🇩🇪", age: 23, since: 2022, contract: "2027", marketValue: "45 Mio. €" },
  { id: 16, name: "Jamie Gittens",      number: 43, positionGroup: "Angriff",   positionShort: "RA",  nationality: "GB", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", age: 21, since: 2022, contract: "2028", marketValue: "50 Mio. €" },
  { id: 17, name: "Donyell Malen",      number: 21, positionGroup: "Angriff",   positionShort: "RA",  nationality: "NL", flag: "🇳🇱", age: 26, since: 2021, contract: "2026", marketValue: "25 Mio. €" },
  { id: 18, name: "Serhou Guirassy",    number: 9,  positionGroup: "Angriff",   positionShort: "ST",  nationality: "GN", flag: "🇬🇳", age: 28, since: 2024, contract: "2028", marketValue: "55 Mio. €" },
];

// ── U23 (BVB II, 3. Liga) ────────────────────────────────────────────────────
const U23: Player[] = [
  { id: 101, name: "Luca Unbehaun",     number: 1,  positionGroup: "Tor",       positionShort: "TW",  nationality: "DE", flag: "🇩🇪", age: 23, since: 2018, contract: "2026" },
  { id: 102, name: "Filippo Mane",      number: 5,  positionGroup: "Abwehr",    positionShort: "IV",  nationality: "IT", flag: "🇮🇹", age: 20, since: 2023, contract: "2026" },
  { id: 103, name: "Kjell Wätjen",      number: 20, positionGroup: "Mittelfeld", positionShort: "ZM", nationality: "DE", flag: "🇩🇪", age: 20, since: 2022, contract: "2026" },
  { id: 104, name: "Almugera Kabar",    number: 11, positionGroup: "Angriff",   positionShort: "LA",  nationality: "DE", flag: "🇩🇪", age: 20, since: 2023, contract: "2026" },
];

// ── U19 (A-Junioren, B-Juniorenliga West) ────────────────────────────────────
const U19: Player[] = [
  { id: 201, name: "Moritz Göttelmann",  number: 1, positionGroup: "Tor",        positionShort: "TW", nationality: "DE", flag: "🇩🇪", age: 18, since: 2020, contract: "" },
  { id: 202, name: "Paris Brunner",      number: 9, positionGroup: "Angriff",    positionShort: "ST", nationality: "DE", flag: "🇩🇪", age: 18, since: 2021, contract: "" },
  { id: 203, name: "Kais Ruiz-Atil",    number: 8, positionGroup: "Mittelfeld",  positionShort: "ZM", nationality: "FR", flag: "🇫🇷", age: 18, since: 2023, contract: "" },
];

// ── Amateur (BVB II bis U23 Jugend) ─────────────────────────────────────────
const AMATEUR: Player[] = [
  { id: 301, name: "Platzhalter — Daten folgen", number: 99, positionGroup: "Angriff", positionShort: "ST", nationality: "DE", flag: "🇩🇪", age: 17, since: 2024, contract: "" },
];

export const SQUADS: SquadDef[] = [
  { id: "profis",  label: "Profis",  league: "Bundesliga",   players: PROFIS },
  { id: "u23",     label: "U23",     league: "3. Liga",       players: U23 },
  { id: "u19",     label: "U19",     league: "U19-Bundesliga West", players: U19 },
  { id: "amateur", label: "Amateur", league: "NRW-Liga",      players: AMATEUR },
];

export function getSquad(id: TeamId): SquadDef {
  return SQUADS.find((s) => s.id === id) ?? SQUADS[0]!;
}
