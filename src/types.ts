export interface Match {
  id: string;
  /** Insertion order; ratings replay in this order */
  seq: number;
  date: string; // ISO yyyy-mm-dd
  player1: string;
  player2: string;
  winner: 1 | 2;
  /** Optional score for records only — never affects ELO */
  score: string | null;
  /** Tournament label (e.g. "Christmas 2024") for records only — never affects ELO */
  tournament: string | null;
}

export interface PlayerStats {
  name: string;
  rating: number;
  played: number;
  wins: number;
  losses: number;
  peakRating: number;
  /** Date the peak rating was reached (null if never above start) */
  peakDate: string | null;
  /** Positive = winning streak, negative = losing streak */
  streak: number;
  /** Longest run of consecutive wins ever */
  bestStreak: number;
  /** Date of the first win of the best streak */
  bestStreakStart: string | null;
  /** Date the best streak was broken (null = still active) */
  bestStreakEnd: string | null;
  /** Best (lowest) leaderboard position ever held, 1 = top */
  bestRank: number;
  /** Date the career-high rank was first reached */
  bestRankDate: string | null;
  lastPlayed: string | null;
  /** Rating after each of the player's matches, for sparklines */
  history: number[];
}

export interface EnrichedMatch extends Match {
  winnerName: string;
  loserName: string;
  rating1Before: number;
  rating2Before: number;
  rating1After: number;
  rating2After: number;
  expected1: number;
  /** Rating points gained by the winner (loser loses the same) */
  delta: number;
}

export type Role = "anon" | "viewer" | "admin";

export interface PlayerProfile {
  name: string;
  /** Data-URL image; null/missing = letter placeholder */
  avatar: string | null;
}

/** A soft-deleted player waiting in the 30-day restore window */
export interface DeletedPlayer {
  name: string;
  matchCount: number;
  deletedAt: string; // ISO timestamp
}

/**
 * A single-set scoreline worth remembering (deuce marathons). Match results
 * don't record per-set points, so admins enter these separately for the
 * "Longest set played" record.
 */
export interface SetRecordEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  winner: string;
  loser: string;
  /** Winner's points first, e.g. "33-31" */
  score: string;
}

export interface Tournament {
  id: string;
  /** Label carried by this tournament's matches, e.g. "Christmas 2024" */
  name: string;
  date: string; // ISO yyyy-mm-dd
  /** Active tournaments accept new matches; completed ones show the final bracket */
  status: "active" | "completed";
  /**
   * Optional pre-planned draw: first-round slots in bracket order (power of 2).
   * Slots 0&1 meet in round 1, slots 2&3, etc. null = bye. When set, the
   * bracket displays up-front and fills in as results are recorded.
   * When null, the bracket is derived from match history after completion.
   */
  bracket: (string | null)[] | null;
}
