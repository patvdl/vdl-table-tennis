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

export interface Tournament {
  id: string;
  /** Label carried by this tournament's matches, e.g. "Christmas 2024" */
  name: string;
  date: string; // ISO yyyy-mm-dd
  /** Active tournaments accept new matches; completed ones show the final bracket */
  status: "active" | "completed";
}
