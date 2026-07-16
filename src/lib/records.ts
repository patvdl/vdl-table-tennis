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
  /** The matches that made up the run, chronological */
  matches: EnrichedMatch[];
}

/** One continuous stint holding a ranking position */
export interface RankSpan {
  start: string;
  /** Date the stint ended; null while still ongoing */
  end: string | null;
  days: number;
}

export interface TopFiveRecord {
  player: string;
  /** Total full days spent ranked in the top 5 */
  days: number;
  current: boolean;
  /** Individual stints, chronological */
  spans: RankSpan[];
}

export interface GiantKillerRecord {
  player: string;
  /** Career wins over whoever was ranked #1 at the time */
  wins: number;
  latest: string;
  /** Breakdown per reigning-#1 victim, most beaten first */
  victims: { name: string; count: number }[];
  /** The individual wins, chronological — the loser was the reigning #1 */
  victories: EnrichedMatch[];
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
  /** Individual reigns, chronological */
  spans: RankSpan[];
}

export interface RecordBook {
  winStreaks: StreakRecord[]; // every individual run, longest first
  lossStreaks: StreakRecord[]; // every individual run, longest first
  upsets: UpsetRecord[]; // most improbable winner first
  highest: RatingExtreme[]; // per player highest ever, best first
  lowest: RatingExtreme[]; // per player lowest ever, worst first
  reigns: ReignRecord[]; // most days at #1 first
  topFive: TopFiveRecord[]; // most days ranked in the top 5 first
  giantKillers: GiantKillerRecord[]; // most wins over reigning #1s first
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
 * Records that depend on the standings over time: for every date on which
 * matches were played, rebuild the leaderboard as it stood at the end of
 * that day (same replay the historical leaderboard view uses — the match
 * log's seq order is not strictly date-ordered, so we can't just walk it
 * linearly). From that one pass we get:
 * - days spent at #1 (the day's #1 holds it until the standings next change)
 * - days spent ranked in the top 5
 * - wins over the reigning #1 (the #1 going into that day's play)
 */
function computeStandingsRecords(enriched: EnrichedMatch[]): {
  reigns: ReignRecord[];
  topFive: TopFiveRecord[];
  giantKillers: GiantKillerRecord[];
} {
  const dates = [...new Set(enriched.map((m) => m.date))].sort();
  const byDate = new Map<string, EnrichedMatch[]>();
  for (const m of enriched) {
    const list = byDate.get(m.date) ?? [];
    list.push(m);
    byDate.set(m.date, list);
  }

  const reignSpans = new Map<string, RankSpan[]>();
  const top5Spans = new Map<string, RankSpan[]>();
  type KillTally = {
    wins: number;
    latest: string;
    victims: Map<string, number>;
    victories: EnrichedMatch[];
  };
  const kills = new Map<string, KillTally>();
  let holder: string | null = null;
  let holderSince: string | null = null;
  let prevTop5 = new Set<string>();
  let currentTop5: string[] = [];

  const openSpan = (map: Map<string, RankSpan[]>, name: string, date: string) => {
    const list = map.get(name) ?? [];
    list.push({ start: date, end: null, days: 0 });
    map.set(name, list);
  };
  const closeSpan = (map: Map<string, RankSpan[]>, name: string, date: string) => {
    const list = map.get(name);
    const last = list?.[list.length - 1];
    if (last && last.end === null) last.end = date;
  };

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    // Wins over the #1: `holder` is still the reigning #1 going into
    // this day's play (standings update after the day's matches).
    if (holder) {
      for (const m of byDate.get(date) ?? []) {
        if (m.loserName !== holder) continue;
        const k: KillTally = kills.get(m.winnerName) ?? {
          wins: 0,
          latest: m.date,
          victims: new Map(),
          victories: [],
        };
        k.wins++;
        k.latest = m.date;
        k.victims.set(holder, (k.victims.get(holder) ?? 0) + 1);
        k.victories.push(m);
        kills.set(m.winnerName, k);
      }
    }

    const asOf = enriched.filter((m) => m.date <= date);
    const board = leaderboard(replay(asOf).stats);
    const top = board[0]?.name;
    if (!top) continue; // nobody rated yet

    if (top !== holder) {
      if (holder) closeSpan(reignSpans, holder, date);
      openSpan(reignSpans, top, date);
      holder = top;
      holderSince = date;
    }

    currentTop5 = board.slice(0, 5).map((p) => p.name);
    for (const name of currentTop5) {
      if (!prevTop5.has(name)) openSpan(top5Spans, name, date);
    }
    for (const name of prevTop5) {
      if (!currentTop5.includes(name)) closeSpan(top5Spans, name, date);
    }
    prevTop5 = new Set(currentTop5);
  }

  // Stamp each stint's length; day totals derive from the stints so the
  // details always add up to the headline number.
  const today = todayIso();
  const finalize = (spans: RankSpan[]) => {
    for (const s of spans) s.days = diffDays(s.start, s.end ?? today);
    return spans.reduce((sum, s) => sum + s.days, 0);
  };

  const reigns = [...reignSpans.entries()]
    .map(([name, spans]) => ({
      player: name,
      days: finalize(spans),
      reigns: spans.length,
      current: name === holder,
      since: name === holder ? holderSince : null,
      spans,
    }))
    .sort((a, b) => b.days - a.days || b.reigns - a.reigns);

  const topFive = [...top5Spans.entries()]
    .map(([name, spans]) => ({
      player: name,
      days: finalize(spans),
      current: currentTop5.includes(name),
      spans,
    }))
    .sort((a, b) => b.days - a.days);

  const giantKillers = [...kills.entries()]
    .map(([name, k]) => ({
      player: name,
      wins: k.wins,
      latest: k.latest,
      victims: [...k.victims.entries()]
        .map(([victim, count]) => ({ name: victim, count }))
        .sort((a, b) => b.count - a.count),
      victories: k.victories,
    }))
    .sort((a, b) => b.wins - a.wins || a.latest.localeCompare(b.latest));

  return { reigns, topFive, giantKillers };
}

export function computeRecords(enriched: EnrichedMatch[]): RecordBook {
  const played = new Map<string, number>();
  const streak = new Map<string, number>(); // >0 win run, <0 loss run
  const winStart = new Map<string, string>();
  const lossStart = new Map<string, string>();
  const winRunMatches = new Map<string, EnrichedMatch[]>();
  const lossRunMatches = new Map<string, EnrichedMatch[]>();
  const winRuns: StreakRecord[] = []; // every completed (or active) run
  const lossRuns: StreakRecord[] = [];
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

    // Streak runs — every run is recorded individually when it ends, so
    // one player can hold several spots in the top-5 lists.
    const winner = m.winnerName;
    const loser = m.loserName;
    const prevW = streak.get(winner) ?? 0;
    const prevL = streak.get(loser) ?? 0;

    // Winning ends any losing run the winner was on
    if (prevW < 0) {
      lossRuns.push({
        player: winner,
        length: -prevW,
        start: lossStart.get(winner) ?? m.date,
        end: m.date,
        matches: lossRunMatches.get(winner) ?? [],
      });
      lossRunMatches.delete(winner);
    }
    const newW = prevW > 0 ? prevW + 1 : 1;
    streak.set(winner, newW);
    if (newW === 1) {
      winStart.set(winner, m.date);
      winRunMatches.set(winner, []);
    }
    winRunMatches.get(winner)?.push(m);

    // Losing ends any winning run the loser was on
    if (prevL > 0) {
      winRuns.push({
        player: loser,
        length: prevL,
        start: winStart.get(loser) ?? m.date,
        end: m.date,
        matches: winRunMatches.get(loser) ?? [],
      });
      winRunMatches.delete(loser);
    }
    const newL = prevL < 0 ? prevL - 1 : -1;
    streak.set(loser, newL);
    if (newL === -1) {
      lossStart.set(loser, m.date);
      lossRunMatches.set(loser, []);
    }
    lossRunMatches.get(loser)?.push(m);

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

  // Runs still alive at the end of the log count too
  for (const [name, s] of streak) {
    if (s > 0) {
      winRuns.push({
        player: name,
        length: s,
        start: winStart.get(name) ?? "",
        end: null,
        matches: winRunMatches.get(name) ?? [],
      });
    } else if (s < 0) {
      lossRuns.push({
        player: name,
        length: -s,
        start: lossStart.get(name) ?? "",
        end: null,
        matches: lossRunMatches.get(name) ?? [],
      });
    }
  }

  const byLengthThenStart = (a: StreakRecord, b: StreakRecord) =>
    b.length - a.length || a.start.localeCompare(b.start);

  const { reigns, topFive, giantKillers } = computeStandingsRecords(enriched);

  return {
    winStreaks: winRuns.sort(byLengthThenStart),
    lossStreaks: lossRuns.sort(byLengthThenStart),
    upsets: upsets.sort((a, b) => a.winProb - b.winProb),
    highest: [...highest.values()].sort((a, b) => b.rating - a.rating),
    lowest: [...lowest.values()].sort((a, b) => a.rating - b.rating),
    reigns,
    topFive,
    giantKillers,
  };
}
