import type { EnrichedMatch } from "../types";
import { RATED_MIN, START_RATING, leaderboard, replay, winProbability } from "./elo";

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
  /** The match that broke the run; null while still active */
  endedBy: EnrichedMatch | null;
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

/** Career tally of wins by a specific set scoreline (3-0 sweeps, 3-2 deciders) */
export interface SetScoreRecord {
  player: string;
  count: number;
  latest: string;
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

export interface SeasonStats {
  player: string;
  played: number;
  wins: number;
  losses: number;
  winPct: number;
  /** Wins over opponents ranked in the top 5 going into that day */
  topFiveWins: number;
  /** Wins over the reigning #1 */
  no1Wins: number;
  /** Matches played against the reigning #1 */
  no1Played: number;
  /** Highest-ranked opponent beaten during the year */
  bestWin: { opponent: string; opponentRank: number; date: string } | null;
  daysAtNo1: number;
  daysTop5: number;
  /** Best rank held at any point during the year */
  bestRank: number | null;
  /** Rank/rating as the year closed (or right now for the current year) */
  endRank: number | null;
  endRating: number | null;
  /** Highest rating held while ranked during the year */
  peakRating: number | null;
  /** Composite season score, 0–100 */
  score: number;
}

export interface SeasonAward {
  year: number;
  /** True for the current calendar year — the race is still open */
  inProgress: boolean;
  winner: SeasonStats | null;
  /** Everyone who played that year, best season first */
  standings: SeasonStats[];
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
  sweeps: SetScoreRecord[]; // most 3-0 wins first
  deciders: SetScoreRecord[]; // most 3-2 wins first
  seasons: SeasonAward[]; // player of the year, oldest year first
}

/**
 * Reads a best-of-5 set scoreline out of a recorded score, winner first.
 * Returns "3-0" | "3-1" | "3-2", or null for point scores ("21-15"),
 * missing scores, or anything else.
 */
export function parseSetScore(score: string | null): string | null {
  if (!score) return null;
  const m = score
    .trim()
    .toLowerCase()
    .replace(/\s*sets?$/, "")
    .replace(/\s+/g, "")
    .match(/^(\d+)[-–](\d+)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 3 && b >= 0 && b <= 2 ? `3-${b}` : null;
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

interface DailyBoard {
  date: string;
  /** Ranked (rated) players as the day closed, best first */
  board: { name: string; rating: number }[];
}

/**
 * The leaderboard as it stood at the end of every match day (same replay
 * the historical leaderboard view uses — the match log's seq order is not
 * strictly date-ordered, so we can't just walk it linearly).
 */
function buildDailyBoards(enriched: EnrichedMatch[]): DailyBoard[] {
  const dates = [...new Set(enriched.map((m) => m.date))].sort();
  return dates.map((date) => ({
    date,
    board: leaderboard(replay(enriched.filter((m) => m.date <= date)).stats).map((p) => ({
      name: p.name,
      rating: p.rating,
    })),
  }));
}

// The match log array from the store is referentially stable between data
// changes, so cache the expensive day-by-day replay per log instance. This
// lets Crowns (rendered on every leaderboard row) share one computation.
const boardsCache = new WeakMap<EnrichedMatch[], DailyBoard[]>();
function dailyBoardsFor(enriched: EnrichedMatch[]): DailyBoard[] {
  let boards = boardsCache.get(enriched);
  if (!boards) {
    boards = buildDailyBoards(enriched);
    boardsCache.set(enriched, boards);
  }
  return boards;
}

const seasonsCache = new WeakMap<EnrichedMatch[], SeasonAward[]>();
/** Player of the Year results, cached per match-log instance */
export function seasonsFor(enriched: EnrichedMatch[]): SeasonAward[] {
  let seasons = seasonsCache.get(enriched);
  if (!seasons) {
    seasons = computeSeasons(enriched, dailyBoardsFor(enriched));
    seasonsCache.set(enriched, seasons);
  }
  return seasons;
}

/**
 * Records that depend on the standings over time, derived from the daily
 * boards:
 * - days spent at #1 (the day's #1 holds it until the standings next change)
 * - days spent ranked in the top 5
 * - wins over the reigning #1 (the #1 going into that day's play)
 */
function computeStandingsRecords(
  enriched: EnrichedMatch[],
  boards: DailyBoard[],
): {
  reigns: ReignRecord[];
  topFive: TopFiveRecord[];
  giantKillers: GiantKillerRecord[];
} {
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

  for (let i = 0; i < boards.length; i++) {
    const { date, board } = boards[i];

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

/**
 * Player of the Year. Every player's season is condensed into a 0–100
 * score blending five signals — quality over quantity:
 * - 25% win rate (taken raw, so grinding volume can't buy it back)
 * - 25% dominance (days at #1, plus days in the top 5 at half weight)
 * - 25% peak rating during the year
 * - 15% quality of wins (top-5 scalps, with wins over the #1 double-weighted)
 * - 10% number of wins
 * All but win rate are normalised against the year's best. Only players
 * who were rated (ranked on the board) during the year are listed;
 * there's no minimum match count beyond being rated.
 */
function computeSeasons(enriched: EnrichedMatch[], boards: DailyBoard[]): SeasonAward[] {
  if (enriched.length === 0) return [];
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const years = [...new Set(enriched.map((m) => Number(m.date.slice(0, 4))))].sort(
    (a, b) => a - b,
  );

  const byYear = new Map<number, Map<string, SeasonStats>>();
  const ensure = (year: number, name: string): SeasonStats => {
    let ymap = byYear.get(year);
    if (!ymap) {
      ymap = new Map();
      byYear.set(year, ymap);
    }
    let s = ymap.get(name);
    if (!s) {
      s = {
        player: name,
        played: 0,
        wins: 0,
        losses: 0,
        winPct: 0,
        topFiveWins: 0,
        no1Wins: 0,
        no1Played: 0,
        bestWin: null,
        daysAtNo1: 0,
        daysTop5: 0,
        bestRank: null,
        endRank: null,
        endRating: null,
        peakRating: null,
        score: 0,
      };
      ymap.set(name, s);
    }
    return s;
  };

  // Standings going into each match day = the previous day's board
  const boardBefore = new Map<string, DailyBoard["board"]>();
  for (let i = 0; i < boards.length; i++) {
    boardBefore.set(boards[i].date, i > 0 ? boards[i - 1].board : []);
  }

  // Match tallies, quality wins and peak ratings. Peaks are tracked per
  // match from the canonical replay (never from the end-of-day boards) so
  // they always agree with the career profile — boards miss intra-day
  // crests, and their date-filtered replay can drift from the real match
  // order. The before-match rating covers a peak carried in from the
  // previous year; only rated moments count, same rule as the record book.
  const careerPlayed = new Map<string, number>();
  for (const m of [...enriched].sort((x, y) => x.seq - y.seq)) {
    const year = Number(m.date.slice(0, 4));
    const w = ensure(year, m.winnerName);
    const l = ensure(year, m.loserName);
    w.played++;
    w.wins++;
    l.played++;
    l.losses++;

    const before = boardBefore.get(m.date) ?? [];
    const loserRank = before.findIndex((p) => p.name === m.loserName) + 1;
    const winnerRank = before.findIndex((p) => p.name === m.winnerName) + 1;
    if (loserRank === 1) {
      w.no1Wins++;
      w.no1Played++;
    }
    if (winnerRank === 1) l.no1Played++;
    if (loserRank > 0) {
      if (loserRank <= 5) w.topFiveWins++;
      if (!w.bestWin || loserRank < w.bestWin.opponentRank) {
        w.bestWin = { opponent: m.loserName, opponentRank: loserRank, date: m.date };
      }
    }

    const played1Before = careerPlayed.get(m.player1) ?? 0;
    const played2Before = careerPlayed.get(m.player2) ?? 0;
    careerPlayed.set(m.player1, played1Before + 1);
    careerPlayed.set(m.player2, played2Before + 1);
    const s1 = ensure(year, m.player1);
    const s2 = ensure(year, m.player2);
    const bump = (s: SeasonStats, rating: number) => {
      if (s.peakRating === null || rating > s.peakRating) s.peakRating = rating;
    };
    if (played1Before >= RATED_MIN) bump(s1, m.rating1Before);
    if (played1Before + 1 >= RATED_MIN) bump(s1, m.rating1After);
    if (played2Before >= RATED_MIN) bump(s2, m.rating2Before);
    if (played2Before + 1 >= RATED_MIN) bump(s2, m.rating2After);
  }

  // Time-based signals: each board holds from its date until the next
  // match day (or today); clip every segment to the years it overlaps.
  for (let i = 0; i < boards.length; i++) {
    const { date, board } = boards[i];
    if (board.length === 0) continue;
    const until = i + 1 < boards.length ? boards[i + 1].date : today;

    const firstYear = Number(date.slice(0, 4));
    const lastYear = Number(until.slice(0, 4));
    for (let year = firstYear; year <= lastYear; year++) {
      const ymap = byYear.get(year);
      if (!ymap) continue; // segment reaches into a year with no matches
      const yStart = `${year}-01-01`;
      const yEnd = `${year + 1}-01-01`;
      if (date >= yEnd) continue;

      const from = date > yStart ? date : yStart;
      const to = until < yEnd ? until : yEnd;
      const overlap = diffDays(from, to);

      if (overlap > 0) {
        const topStats = ymap.get(board[0].name);
        if (topStats) topStats.daysAtNo1 += overlap;
        for (const p of board.slice(0, 5)) {
          const s = ymap.get(p.name);
          if (s) s.daysTop5 += overlap;
        }
      }

      // Ranks held while this board was in effect during `year`. Later
      // boards overwrite endRank, so the last one standing is the year-end
      // (or current) position. (Peak rating is tracked per match above.)
      board.forEach((p, idx) => {
        const s = ymap.get(p.name);
        if (!s) return;
        const rank = idx + 1;
        if (s.bestRank === null || rank < s.bestRank) s.bestRank = rank;
        s.endRank = rank;
        s.endRating = p.rating;
      });
    }
  }

  // Score each season
  return years.map((year) => {
    const list = [...(byYear.get(year)?.values() ?? [])];
    for (const s of list) s.winPct = s.played > 0 ? s.wins / s.played : 0;

    // Only rated players compete — having appeared on the ranked board
    // during the year means they had RATED_MIN+ career matches by then.
    const rated = list.filter((s) => s.bestRank !== null);

    const quality = (s: SeasonStats) => s.topFiveWins + s.no1Wins; // #1 wins count twice
    const dominance = (s: SeasonStats) => s.daysAtNo1 + 0.5 * s.daysTop5;
    const ratingX = (s: SeasonStats) => Math.max(0, (s.peakRating ?? START_RATING) - START_RATING);
    const norm = (f: (s: SeasonStats) => number) => {
      const max = Math.max(...rated.map(f), 0);
      return (s: SeasonStats) => (max > 0 ? Math.min(f(s) / max, 1) : 0);
    };
    const nWins = norm((s) => s.wins);
    const nQuality = norm(quality);
    const nDominance = norm(dominance);
    const nRating = norm(ratingX);

    for (const s of rated) {
      s.score =
        Math.round(
          100 *
            (0.25 * s.winPct +
              0.25 * nDominance(s) +
              0.25 * nRating(s) +
              0.15 * nQuality(s) +
              0.1 * nWins(s)) *
            10,
        ) / 10;
    }

    const standings = rated.sort(
      (a, b) => b.score - a.score || b.winPct - a.winPct || b.wins - a.wins,
    );
    const winner = standings[0] ?? null;

    return { year, inProgress: year === currentYear, winner, standings };
  });
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
  const sweeps = new Map<string, SetScoreRecord>(); // 3-0 wins
  const deciders = new Map<string, SetScoreRecord>(); // 3-2 wins

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

    // Set-scoreline tallies — only matches recorded with a sets score count
    const setScore = parseSetScore(m.score);
    if (setScore === "3-0" || setScore === "3-2") {
      const map = setScore === "3-0" ? sweeps : deciders;
      const rec = map.get(m.winnerName) ?? { player: m.winnerName, count: 0, latest: m.date };
      rec.count++;
      rec.latest = m.date;
      map.set(m.winnerName, rec);
    }

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
        endedBy: m,
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
        endedBy: m,
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
        endedBy: null,
      });
    } else if (s < 0) {
      lossRuns.push({
        player: name,
        length: -s,
        start: lossStart.get(name) ?? "",
        end: null,
        matches: lossRunMatches.get(name) ?? [],
        endedBy: null,
      });
    }
  }

  const byLengthThenStart = (a: StreakRecord, b: StreakRecord) =>
    b.length - a.length || a.start.localeCompare(b.start);

  const boards = dailyBoardsFor(enriched);
  const { reigns, topFive, giantKillers } = computeStandingsRecords(enriched, boards);

  return {
    winStreaks: winRuns.sort(byLengthThenStart),
    lossStreaks: lossRuns.sort(byLengthThenStart),
    upsets: upsets.sort((a, b) => a.winProb - b.winProb),
    highest: [...highest.values()].sort((a, b) => b.rating - a.rating),
    lowest: [...lowest.values()].sort((a, b) => a.rating - b.rating),
    reigns,
    topFive,
    giantKillers,
    sweeps: [...sweeps.values()].sort(
      (a, b) => b.count - a.count || a.latest.localeCompare(b.latest),
    ),
    deciders: [...deciders.values()].sort(
      (a, b) => b.count - a.count || a.latest.localeCompare(b.latest),
    ),
    seasons: seasonsFor(enriched),
  };
}

/**
 * A single player's streak history: their best run of consecutive wins and
 * worst run of consecutive losses, with the matches inside each and the
 * match that broke it. Cheap enough to run on the profile page directly.
 */
export function playerStreaks(
  enriched: EnrichedMatch[],
  player: string,
): { bestWin: StreakRecord | null; worstLoss: StreakRecord | null } {
  const mine = enriched
    .filter((m) => m.player1 === player || m.player2 === player)
    .sort((a, b) => a.seq - b.seq);

  const runs: StreakRecord[] = [];
  let current: StreakRecord | null = null;
  let winning = false;

  for (const m of mine) {
    const won = m.winnerName === player;
    if (current && won === winning) {
      current.length++;
      current.matches.push(m);
    } else {
      if (current) {
        current.end = m.date;
        current.endedBy = m;
      }
      current = { player, length: 1, start: m.date, end: null, matches: [m], endedBy: null };
      winning = won;
      runs.push(current);
    }
  }

  const wins = runs.filter((r) => r.matches[0].winnerName === player);
  const losses = runs.filter((r) => r.matches[0].winnerName !== player);
  const best = (list: StreakRecord[]) =>
    list.length === 0
      ? null
      : list.reduce((a, b) => (b.length > a.length ? b : a));

  return { bestWin: best(wins), worstLoss: best(losses) };
}

/**
 * The best win of a player's career: the victory over the highest-ranked
 * opponent (rank as the standings stood going into that match day).
 * Earliest such scalp wins ties.
 */
export function bestCareerWin(
  enriched: EnrichedMatch[],
  player: string,
): { match: EnrichedMatch; opponentRank: number } | null {
  const boards = dailyBoardsFor(enriched);
  const boardBefore = new Map<string, DailyBoard["board"]>();
  for (let i = 0; i < boards.length; i++) {
    boardBefore.set(boards[i].date, i > 0 ? boards[i - 1].board : []);
  }

  let best: { match: EnrichedMatch; opponentRank: number } | null = null;
  for (const m of enriched) {
    if (m.winnerName !== player) continue;
    const rank = (boardBefore.get(m.date) ?? []).findIndex((p) => p.name === m.loserName) + 1;
    if (rank > 0 && (!best || rank < best.opponentRank)) {
      best = { match: m, opponentRank: rank };
    }
  }
  return best;
}
