import type { Match, EnrichedMatch, PlayerStats } from "../types";

export const START_RATING = 1000;

/**
 * Balanced ELO:
 * - Expected score uses the classic 400-point logistic curve, so the
 *   pre-match ranking gap decides how many points change hands.
 * - Beating a much weaker player always earns something (small, but it
 *   adds up over e.g. 10 wins), while an upset win pays out big.
 * - New players use a higher K for their first matches so they settle
 *   near their true level quickly, and their established opponents
 *   aren't over-punished thanks to the reduced established K.
 */
const K_PROVISIONAL = 40; // player's first matches
const K_STANDARD = 24;
const PROVISIONAL_GAMES = 10;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function kFor(gamesPlayed: number): number {
  return gamesPlayed < PROVISIONAL_GAMES ? K_PROVISIONAL : K_STANDARD;
}

export interface ReplayResult {
  stats: Map<string, PlayerStats>;
  enriched: EnrichedMatch[];
}

/** Replays the full match log in seq order and derives all ratings. */
export function replay(matches: Match[]): ReplayResult {
  const ordered = [...matches].sort((a, b) => a.seq - b.seq);
  const stats = new Map<string, PlayerStats>();
  const enriched: EnrichedMatch[] = [];

  const ensure = (name: string): PlayerStats => {
    let s = stats.get(name);
    if (!s) {
      s = {
        name,
        rating: START_RATING,
        played: 0,
        wins: 0,
        losses: 0,
        peakRating: START_RATING,
        streak: 0,
        lastPlayed: null,
        history: [START_RATING],
      };
      stats.set(name, s);
    }
    return s;
  };

  for (const m of ordered) {
    const p1 = ensure(m.player1);
    const p2 = ensure(m.player2);

    const e1 = expectedScore(p1.rating, p2.rating);
    const s1 = m.winner === 1 ? 1 : 0;

    const k1 = kFor(p1.played);
    const k2 = kFor(p2.played);

    const r1After = p1.rating + k1 * (s1 - e1);
    const r2After = p2.rating + k2 * (1 - s1 - (1 - e1));

    enriched.push({
      ...m,
      winnerName: m.winner === 1 ? m.player1 : m.player2,
      loserName: m.winner === 1 ? m.player2 : m.player1,
      rating1Before: p1.rating,
      rating2Before: p2.rating,
      rating1After: r1After,
      rating2After: r2After,
      expected1: e1,
      delta: m.winner === 1 ? r1After - p1.rating : r2After - p2.rating,
    });

    p1.rating = r1After;
    p2.rating = r2After;
    p1.peakRating = Math.max(p1.peakRating, r1After);
    p2.peakRating = Math.max(p2.peakRating, r2After);
    p1.played++;
    p2.played++;
    if (m.winner === 1) {
      p1.wins++;
      p2.losses++;
      p1.streak = p1.streak > 0 ? p1.streak + 1 : 1;
      p2.streak = p2.streak < 0 ? p2.streak - 1 : -1;
    } else {
      p2.wins++;
      p1.losses++;
      p2.streak = p2.streak > 0 ? p2.streak + 1 : 1;
      p1.streak = p1.streak < 0 ? p1.streak - 1 : -1;
    }
    p1.lastPlayed = m.date;
    p2.lastPlayed = m.date;
    p1.history.push(r1After);
    p2.history.push(r2After);
  }

  return { stats, enriched };
}

export function leaderboard(stats: Map<string, PlayerStats>): PlayerStats[] {
  return [...stats.values()].sort((a, b) => b.rating - a.rating);
}

export interface HeadToHead {
  a: string;
  b: string;
  total: number;
  winsA: number;
  winsB: number;
  /** Current streak: holder + length (e.g. Patrick has won last 4) */
  streakHolder: string | null;
  streakLength: number;
  /** Longest streak either way */
  bestStreakA: number;
  bestStreakB: number;
  ratingSwingA: number; // net rating A gained from this matchup
  matches: EnrichedMatch[]; // chronological
  firstMeeting: string | null;
  lastMeeting: string | null;
}

export function headToHead(enriched: EnrichedMatch[], a: string, b: string): HeadToHead {
  const between = enriched.filter(
    (m) =>
      (m.player1 === a && m.player2 === b) ||
      (m.player1 === b && m.player2 === a),
  );

  let winsA = 0;
  let winsB = 0;
  let streakHolder: string | null = null;
  let streakLength = 0;
  let bestStreakA = 0;
  let bestStreakB = 0;
  let ratingSwingA = 0;

  for (const m of between) {
    const aWon = m.winnerName === a;
    if (aWon) winsA++;
    else winsB++;

    const winner = aWon ? a : b;
    if (streakHolder === winner) streakLength++;
    else {
      streakHolder = winner;
      streakLength = 1;
    }
    if (winner === a) bestStreakA = Math.max(bestStreakA, streakLength);
    else bestStreakB = Math.max(bestStreakB, streakLength);

    const aIsP1 = m.player1 === a;
    ratingSwingA += aIsP1
      ? m.rating1After - m.rating1Before
      : m.rating2After - m.rating2Before;
  }

  return {
    a,
    b,
    total: between.length,
    winsA,
    winsB,
    streakHolder: between.length ? streakHolder : null,
    streakLength,
    bestStreakA,
    bestStreakB,
    ratingSwingA,
    matches: between,
    firstMeeting: between.length ? between[0].date : null,
    lastMeeting: between.length ? between[between.length - 1].date : null,
  };
}
