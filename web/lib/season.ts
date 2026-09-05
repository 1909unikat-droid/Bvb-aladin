/**
 * Central Bundesliga season helper (universal module — NO Node imports).
 * OpenLigaDB identifies a season by its starting year: "bl1/2026" = 2026/27.
 * Rollover on July 1st: from July we consider the NEW season current.
 */

/** Starting year of the current season (e.g. 2026 for 2026/27 from 2026-07-01). */
export function seasonYear(d: Date = new Date()): number {
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Human label like "2026/27". */
export function seasonLabel(year: number = seasonYear()): string {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Previous season's starting year. */
export function previousSeasonYear(d: Date = new Date()): number {
  return seasonYear(d) - 1;
}
