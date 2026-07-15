import type { EnrichedMatch } from "../types";
import { RATED_MIN, leaderboard, replay, winProbability } from "./elo";

/**
 * All-time record book, derived from a single chronological scan of the
 * match log. Rating-based records (upsets, highest/lowest ever, days at
 * number 1) only count moments where the players involved were rated
 * (RATED_MIN+ completed matches), matching the leaderboard rules —
 * provisional ratings from a player's first couple of games aren't
 * meaningful enough to set records with.
 */

export interface StreakRecord {
  player: string;
  length: number;
  start: string;
  /** Date the run was broken; null while still active */
  end: string | null;
}

export interface UpsetRecord {
  match: EnrichedMatch;
  winner: string;
  loser: string;
  /** Pre-match win probability the eventual winner had, per the predictor */
  winProb: number;
  winnerRating: number;
  loserRating: number;
}

export interface RatingExtreme {
  player: string;
  rating: number;
  date: string;
}

export interface ReignRecord {
  player: string;
  /** Total full days spent at #1 across all reigns */
  days: number;
  /** Number of separate stints at #1 */
  reigns: number;
  current: boolean;
  /** Start date of the current reign (only for the current holder) */
  since: string | null;
}

export interface RecordBook {
  winStreaks: StreakRecord[]; // per player best, longest first
  lossStreaks: StreakRecord[]; // per player worst, longest first
  upsets: UpsetRecord[]; // most improbable winner first
  highest: RatingExtreme[]; // per player highest ever, best first
  lowest: RatingExtreme[]; // per player lowest ever, worst first
  reigns: ReignRecord[]; // most days at #1 first
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function diffDays(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000));
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Days spent at #1: for every date on which matches were played, rebuild
 * the standings as they stood at the end of that day (same replay the
 * historical leaderboard view uses — the match log's seq order is not
 * strictly date-ordered, so we can't just walk it linearly) and credit
 * the #1 with the days until the standings next changed.
 */
function computeReigns(enriched: EnrichedMatch[]): ReignRecord[] {
  const dates = [...new Set(enriched.map((m) => m.date))].sort();
  const daysAtTop = new Map<string, number>();
  const reignCounts = new Map<string, number>();
  let holder: string | null = null;
  let holderSince: string | null = null;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const asOf = enriched.filter((m) => m.date <= date);
    const top = leaderboard(replay(asOf).stats)[0]?.name;
    if (!top) continue; // nobody rated yet

    if (top !== holder) {
      holder = top;
      holderSince = date;
      reignCounts.set(top, (reignCounts.get(top) ?? 0) + 1);
    }
    const until = i + 1 < dates.length ? dates[i + 1] : todayIso();
    daysAtTop.set(top, (daysAtTop.get(top) ?? 0) + diffDays(date, until));
  }

  return [...reignCounts.keys()]
    .map((name) => ({
      player: name,
      days: daysAtTop.get(name) ?? 0,
      reigns: reignCounts.get(name) ?? 0,
      current: name === holder,
      since: name === holder ? holderSince : null,
    }))
    .sort((a, b) => b.days - a.days || b.reigns - a.reigns);
}

export function computeRecords(enriched: EnrichedMatch[]): RecordBook {
  const played = new Map<string, number>();
  const streak = new Map<string, number>(); // >0 win run, <0 loss run
  const winStart = new Map<string, string>();
  const lossStart = new Map<string, string>();
  const bestWin = new Map<string, StreakRecord>();
  const bestLoss = new Map<string, StreakRecord>();
  const highest = new Map<string, RatingExtreme>();
  const lowest = new Map<string, RatingExtreme>();
  const pairWinners = new Map<string, string[]>(); // chronological winner names
  const upsets: UpsetRecord[] = [];

  const ordered = [...enriched].sort((a, b) => a.seq - b.seq);

  for (const m of ordered) {
    const played1 = played.get(m.player1) ?? 0;
    const played2 = played.get(m.player2) ?? 0;
    const streak1 = streak.get(m.player1) ?? 0;
    const streak2 = streak.get(m.player2) ?? 0;
    const key = pairKey(m.player1, m.player2);
    const winners = pairWinners.get(key) ?? [];

    // Upset check: what the predictor would have said just before this
    // match, using only information available at the time.
    if (played1 >= RATED_MIN && played2 >= RATED_MIN) {
      const p1WonNewestFirst: boolean[] = [];
      for (let i = winners.length - 1; i >= 0; i--) {
        p1WonNewestFirst.push(winners[i] === m.player1);
      }
      const { pA } = winProbability(
        m.rating1Before,
        m.rating2Before,
        streak1,
        streak2,
        p1WonNewestFirst,
      );
      const winProb = m.winner === 1 ? pA : 1 - pA;
      if (winProb < 0.5) {
        upsets.push({
          match: m,
          winner: m.winnerName,
          loser: m.loserName,
          winProb,
          winnerRating: m.winner === 1 ? m.rating1Before : m.rating2Before,
          loserRating: m.winner === 1 ? m.rating2Before : m.rating1Before,
        });
      }
    }

    winners.push(m.winnerName);
    pairWinners.set(key, winners);

    // Win/loss streak records
    const winner = m.winnerName;
    const loser = m.loserName;
    const prevW = streak.get(winner) ?? 0;
    const prevL = streak.get(loser) ?? 0;

    const newW = prevW > 0 ? prevW + 1 : 1;
    streak.set(winner, newW);
    if (newW === 1) winStart.set(winner, m.date);
    const bw = bestWin.get(winner);
    if (!bw || newW > bw.length) {
      bestWin.set(winner, {
        player: winner,
        length: newW,
        start: winStart.get(winner) ?? m.date,
        end: null,
      });
    }
    // Winning ends any losing run — stamp the end date if it was a record
    const wl = bestLoss.get(winner);
    if (prevW < 0 && wl && -prevW === wl.length && wl.end === null) wl.end = m.date;

    const newL = prevL < 0 ? prevL - 1 : -1;
    streak.set(loser, newL);
    if (newL === -1) lossStart.set(loser, m.date);
    const bl = bestLoss.get(loser);
    if (!bl || -newL > bl.length) {
      bestLoss.set(loser, {
        player: loser,
        length: -newL,
        start: lossStart.get(loser) ?? m.date,
        end: null,
      });
    }
    // Losing ends any winning run — stamp the end date if it was a record
    const lw = bestWin.get(loser);
    if (prevL > 0 && lw && prevL === lw.length && lw.end === null) lw.end = m.date;

    // Rated-moment rating extremes
    played.set(m.player1, played1 + 1);
    played.set(m.player2, played2 + 1);

    const consider = (name: string, playedAfter: number, rating: number) => {
      if (playedAfter < RATED_MIN) return;
      const hi = highest.get(name);
      if (!hi || rating > hi.rating) highest.set(name, { player: name, rating, date: m.date });
      const lo = lowest.get(name);
      if (!lo || rating < lo.rating) lowest.set(name, { player: name, rating, date: m.date });
    };
    consider(m.player1, played1 + 1, m.rating1After);
    consider(m.player2, played2 + 1, m.rating2After);
  }

  const byLengthThenStart = (a: StreakRecord, b: StreakRecord) =>
    b.length - a.length || a.start.localeCompare(b.start);

  return {
    winStreaks: [...bestWin.values()].sort(byLengthThenStart),
    lossStreaks: [...bestLoss.values()].sort(byLengthThenStart),
    upsets: upsets.sort((a, b) => a.winProb - b.winProb),
    highest: [...highest.values()].sort((a, b) => b.rating - a.rating),
    lowest: [...lowest.values()].sort((a, b) => a.rating - b.rating),
    reigns: computeReigns(enriched),
  };
}
