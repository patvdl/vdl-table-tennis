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
}

export interface PlayerStats {
  name: string;
  rating: number;
  played: number;
  wins: number;
  losses: number;
  peakRating: number;
  /** Positive = winning streak, negative = losing streak */
  streak: number;
  /** Longest run of consecutive wins ever */
  bestStreak: number;
  /** Best (lowest) leaderboard position ever held, 1 = top */
  bestRank: number;
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
