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
 * - Streak dampening: when the same player keeps beating the same
 *   opponent, each consecutive win transfers fewer points (both gained
 *   and lost), floored at 20%. Being farmed by one dominant rival can't
 *   sink a player to the bottom of the table, and the farmer can't
 *   climb forever off one matchup. The moment the underdog wins, the
 *   damping resets and the upset pays out in full.
 * - Unrated players: someone with fewer than RATED_MIN completed
 *   matches doesn't appear in the rankings and doesn't move anyone
 *   else's rating yet. Their own rating still calibrates from those
 *   first matches (so they debut at a fair level), and every result is
 *   recorded for head-to-head and win/loss records as normal.
 */
const K_PROVISIONAL = 40; // player's first matches
const K_STANDARD = 24;
const PROVISIONAL_GAMES = 10;
const STREAK_DAMP = 0.85; // per consecutive win vs the same opponent
const STREAK_DAMP_FLOOR = 0.2;

/** Matches a player must complete before they are ranked/rated */
export const RATED_MIN = 3;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function kFor(gamesPlayed: number): number {
  return gamesPlayed < PROVISIONAL_GAMES ? K_PROVISIONAL : K_STANDARD;
}

/** Multiplier for a win where the winner already holds `priorWins` in a row vs this opponent. */
export function streakDamp(priorWins: number): number {
  return Math.max(STREAK_DAMP_FLOOR, Math.pow(STREAK_DAMP, priorWins));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
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
  // Consecutive wins held by one player within each matchup pair
  const pairStreaks = new Map<string, { holder: string; count: number }>();
  // Date each player's current win streak began
  const winStreakStart = new Map<string, string>();

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
        peakDate: null,
        streak: 0,
        bestStreak: 0,
        bestStreakStart: null,
        bestStreakEnd: null,
        bestRank: Number.MAX_SAFE_INTEGER,
        bestRankDate: null,
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

    // Dampen the exchange when the winner is piling up consecutive wins
    // against this same opponent (both sides move less).
    const key = pairKey(m.player1, m.player2);
    const winnerName = m.winner === 1 ? m.player1 : m.player2;
    const ps = pairStreaks.get(key);
    const priorWins = ps && ps.holder === winnerName ? ps.count : 0;
    const damp = streakDamp(priorWins);

    // A rating only moves when the opponent is rated (RATED_MIN+ matches
    // completed). Unrated newcomers can't shift anyone else's rating, but
    // their own rating still calibrates against rated opponents.
    const p1Moves = p2.played >= RATED_MIN;
    const p2Moves = p1.played >= RATED_MIN;

    const r1After = p1Moves ? p1.rating + k1 * (s1 - e1) * damp : p1.rating;
    const r2After = p2Moves ? p2.rating + k2 * (1 - s1 - (1 - e1)) * damp : p2.rating;

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
    if (r1After > p1.peakRating) {
      p1.peakRating = r1After;
      p1.peakDate = m.date;
    }
    if (r2After > p2.peakRating) {
      p2.peakRating = r2After;
      p2.peakDate = m.date;
    }
    p1.played++;
    p2.played++;

    const winner = m.winner === 1 ? p1 : p2;
    const loser = m.winner === 1 ? p2 : p1;
    winner.wins++;
    loser.losses++;

    winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
    if (winner.streak === 1) winStreakStart.set(winner.name, m.date);
    if (winner.streak > winner.bestStreak) {
      winner.bestStreak = winner.streak;
      winner.bestStreakStart = winStreakStart.get(winner.name) ?? m.date;
      winner.bestStreakEnd = null; // still active
    }

    const loserPrevStreak = loser.streak;
    loser.streak = loser.streak < 0 ? loser.streak - 1 : -1;
    // If the run that just ended was the player's record, stamp its end date
    if (
      loserPrevStreak > 0 &&
      loserPrevStreak === loser.bestStreak &&
      loser.bestStreakEnd === null
    ) {
      loser.bestStreakEnd = m.date;
    }

    // Advance the matchup streak counter
    if (ps && ps.holder === winnerName) ps.count++;
    else pairStreaks.set(key, { holder: winnerName, count: 1 });

    p1.lastPlayed = m.date;
    p2.lastPlayed = m.date;
    p1.history.push(r1After);
    p2.history.push(r2After);

    // Track career-high ranking: standings can shift for everyone after
    // any match, so re-rank all debuted players (tiny N, cost is trivial).
    // Only rated players (RATED_MIN+ matches) occupy ranking spots.
    const ranked = [...stats.values()]
      .filter((p) => p.played >= RATED_MIN)
      .sort((a, b) => b.rating - a.rating);
    for (let i = 0; i < ranked.length; i++) {
      if (i + 1 < ranked[i].bestRank) {
        ranked[i].bestRank = i + 1;
        ranked[i].bestRankDate = m.date;
      }
    }
  }

  return { stats, enriched };
}

/** Ranked players only — needs RATED_MIN completed matches to appear. */
export function leaderboard(stats: Map<string, PlayerStats>): PlayerStats[] {
  return [...stats.values()]
    .filter((p) => p.played >= RATED_MIN)
    .sort((a, b) => b.rating - a.rating);
}

/** Players still working toward their first ranking. */
export function unratedPlayers(stats: Map<string, PlayerStats>): PlayerStats[] {
  return [...stats.values()]
    .filter((p) => p.played < RATED_MIN)
    .sort((a, b) => b.played - a.played || a.name.localeCompare(b.name));
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

/* ---------- match prediction ----------
 *
 * The win predictor blends three signals:
 * 1. Rating gap (classic ELO expected score) — the baseline.
 * 2. Current form — each player's overall win/loss streak nudges their
 *    effective rating up or down (capped so one hot run can't dominate).
 * 3. Head-to-head record — the strongest signal. Meetings are weighted
 *    so recent results count more than old ones, and the h2h evidence
 *    is combined with the rating baseline as a Bayesian prior worth
 *    PRIOR_STRENGTH pseudo-matches. With few meetings the rating edge
 *    dominates; once a real rivalry history exists, it takes over.
 */
const H2H_DECAY = 0.9; // weight multiplier per match into the past
const PRIOR_STRENGTH = 3; // rating prior worth this many h2h matches
const FORM_POINTS = 6; // effective rating points per streak game
const FORM_CAP = 5; // streak games counted at most

export interface MatchPrediction {
  /** Probability that player A wins the match */
  pA: number;
  /** Rating-only probability (no form, no h2h) */
  pRating: number;
  /** Rating + current form probability (the h2h prior) */
  pElo: number;
  h2hWinsA: number;
  h2hWinsB: number;
  streakA: number;
  streakB: number;
  /** Most likely best-of-5 scoreline, e.g. {a: 3, b: 1} */
  sets: { a: number; b: number };
}

/**
 * Predicted best-of-5 scoreline. A near coin-flip should read as a 3–2
 * battle, a solid favourite takes it 3–1, and a heavy favourite sweeps.
 */
function predictSets(pA: number): { a: number; b: number } {
  const winnerP = Math.max(pA, 1 - pA);
  const loserSets = winnerP >= 0.8 ? 0 : winnerP >= 0.6 ? 1 : 2;
  return pA >= 0.5 ? { a: 3, b: loserSets } : { a: loserSets, b: 3 };
}

export function predictMatch(
  enriched: EnrichedMatch[],
  stats: Map<string, PlayerStats>,
  a: string,
  b: string,
): MatchPrediction {
  const sa = stats.get(a);
  const sb = stats.get(b);
  const ra = sa?.rating ?? START_RATING;
  const rb = sb?.rating ?? START_RATING;
  const streakA = sa?.streak ?? 0;
  const streakB = sb?.streak ?? 0;

  const pRating = expectedScore(ra, rb);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const formA = clamp(streakA, -FORM_CAP, FORM_CAP) * FORM_POINTS;
  const formB = clamp(streakB, -FORM_CAP, FORM_CAP) * FORM_POINTS;
  const pElo = expectedScore(ra + formA, rb + formB);

  const between = enriched.filter(
    (m) =>
      (m.player1 === a && m.player2 === b) ||
      (m.player1 === b && m.player2 === a),
  );

  let weightedA = 0;
  let weightedTotal = 0;
  let h2hWinsA = 0;
  let h2hWinsB = 0;
  for (let i = 0; i < between.length; i++) {
    const m = between[between.length - 1 - i]; // i = matches into the past
    const w = Math.pow(H2H_DECAY, i);
    weightedTotal += w;
    if (m.winnerName === a) {
      weightedA += w;
      h2hWinsA++;
    } else {
      h2hWinsB++;
    }
  }

  const pA = (weightedA + PRIOR_STRENGTH * pElo) / (weightedTotal + PRIOR_STRENGTH);

  return {
    pA,
    pRating,
    pElo,
    h2hWinsA,
    h2hWinsB,
    streakA,
    streakB,
    sets: predictSets(pA),
  };
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
