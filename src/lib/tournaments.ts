/**
 * Tournament roll of honour. Champions are recorded here; the matching
 * matches carry the same tournament label (for records only — tournament
 * matches count toward ELO exactly like any other match).
 */
export interface Tournament {
  /** Label used on matches, e.g. "Christmas 2024" */
  name: string;
  date: string; // ISO yyyy-mm-dd
  champion: string;
}

export const TOURNAMENTS: Tournament[] = [
  { name: "Christmas 2024", date: "2024-12-25", champion: "Paul" },
  { name: "Christmas 2025", date: "2025-12-25", champion: "Patrick" },
];

const newestFirst = [...TOURNAMENTS].sort((a, b) => b.date.localeCompare(a.date));

/** The most recent tournament — its champion is the defending champion. */
export const LATEST_TOURNAMENT: Tournament | null = newestFirst[0] ?? null;

/** All tournaments won by a player, newest first. */
export function titlesFor(player: string): Tournament[] {
  return newestFirst.filter((t) => t.champion === player);
}

export function isDefendingChampion(player: string): boolean {
  return LATEST_TOURNAMENT?.champion === player;
}
