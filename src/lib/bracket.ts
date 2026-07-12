import type { EnrichedMatch } from "../types";

/**
 * Two ways to get a bracket:
 *
 * 1. PLANNED — the tournament has a stored draw (first-round slots in bracket
 *    order, null = bye). The bracket displays up-front with TBD slots and
 *    fills in live as matches are recorded: results are matched to their
 *    bracket pairing, byes auto-advance.
 *
 * 2. DERIVED — no stored draw (the historical tournaments). The structure is
 *    reconstructed from match order after completion: every loss eliminates a
 *    player, a match between two already-eliminated players is the 3rd-place
 *    playoff, the last main-draw match is the final, and rounds are walked
 *    backwards from there.
 */

export interface BracketNode {
  match: EnrichedMatch;
  /** Depth from the final: 0 = final, 1 = semi, 2 = quarter... */
  depth: number;
  /** Feeder for player1/player2 — an earlier match, or null (bye / direct entry) */
  feed1: BracketNode | null;
  feed2: BracketNode | null;
}

export interface PlannedNode {
  depth: number;
  feed1: PlannedNode | null;
  feed2: PlannedNode | null;
  /** Participants; null = not yet determined (TBD) */
  player1: string | null;
  player2: string | null;
  /** A bye side will never produce a player */
  bye1: boolean;
  bye2: boolean;
  /** Real pairing (neither side is a bye) */
  isContest: boolean;
  /** No players anywhere in this subtree — pruned from display */
  isDead: boolean;
  /** Recorded result, once played */
  match: EnrichedMatch | null;
  /** Player advancing to the next round (result winner or bye walkover) */
  winner: string | null;
}

export interface TournamentAnalysis {
  matches: EnrichedMatch[];
  players: string[];
  final: EnrichedMatch | null;
  thirdPlaceMatch: EnrichedMatch | null;
  /** SF losers with the 3rd-place match still to be played (planned mode) */
  thirdPlacePending: [string, string] | null;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  /** Derived bracket tree (tournaments without a stored draw) */
  bracket: BracketNode | null;
  /** Planned bracket tree (tournaments with a stored draw) */
  planned: PlannedNode | null;
  /** Max depth of the tree (0-based); rounds = maxDepth + 1 */
  maxDepth: number;
  /** Round label for every match id (e.g. "Final", "Semi-final", "3rd place") */
  roundOf: Map<string, string>;
}

export function roundLabel(depth: number, maxDepth: number): string {
  if (depth === 0) return "Final";
  if (depth === 1) return "Semi-final";
  if (depth === 2) return "Quarter-final";
  return `Round ${maxDepth - depth + 1}`;
}

export function isValidDraw(draw: unknown): draw is (string | null)[] {
  return (
    Array.isArray(draw) &&
    draw.length >= 4 &&
    (draw.length & (draw.length - 1)) === 0 &&
    draw.some((s) => typeof s === "string" && s.trim() !== "")
  );
}

export function analyzeTournament(
  tMatches: EnrichedMatch[],
  draw?: (string | null)[] | null,
): TournamentAnalysis {
  const ordered = [...tMatches].sort((a, b) => a.seq - b.seq);
  if (draw && isValidDraw(draw)) return analyzePlanned(ordered, draw);
  return analyzeDerived(ordered);
}

/* ---------------- planned mode ---------------- */

function analyzePlanned(
  ordered: EnrichedMatch[],
  draw: (string | null)[],
): TournamentAnalysis {
  const rounds = Math.log2(draw.length);
  const maxDepth = rounds - 1;

  const used = new Set<string>();
  const takeMatch = (a: string, b: string): EnrichedMatch | null => {
    for (const m of ordered) {
      if (used.has(m.id)) continue;
      if (
        (m.player1 === a && m.player2 === b) ||
        (m.player1 === b && m.player2 === a)
      ) {
        used.add(m.id);
        return m;
      }
    }
    return null;
  };

  const makeNode = (
    depth: number,
    feed1: PlannedNode | null,
    feed2: PlannedNode | null,
    player1: string | null,
    player2: string | null,
    bye1: boolean,
    bye2: boolean,
  ): PlannedNode => {
    const isDead = bye1 && bye2;
    const isContest = !bye1 && !bye2;
    let match: EnrichedMatch | null = null;
    let winner: string | null = null;
    if (isContest) {
      if (player1 && player2) {
        match = takeMatch(player1, player2);
        winner = match ? match.winnerName : null;
      }
    } else if (!isDead) {
      // Walkover: the non-bye side advances (may still be TBD)
      winner = bye1 ? player2 : player1;
    }
    return { depth, feed1, feed2, player1, player2, bye1, bye2, isContest, isDead, match, winner };
  };

  // Round 1 from the draw, then collapse level by level up to the final
  let level: PlannedNode[] = [];
  for (let i = 0; i < draw.length; i += 2) {
    const p1 = draw[i] || null;
    const p2 = draw[i + 1] || null;
    level.push(makeNode(maxDepth, null, null, p1, p2, !p1, !p2));
  }
  let depth = maxDepth;
  while (level.length > 1) {
    depth -= 1;
    const next: PlannedNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const c1 = level[i];
      const c2 = level[i + 1];
      next.push(makeNode(depth, c1, c2, c1.winner, c2.winner, c1.isDead, c2.isDead));
    }
    level = next;
  }
  const root = level[0];

  const roundOf = new Map<string, string>();
  const walk = (n: PlannedNode | null) => {
    if (!n) return;
    if (n.match) roundOf.set(n.match.id, roundLabel(n.depth, maxDepth));
    walk(n.feed1);
    walk(n.feed2);
  };
  walk(root);

  // 3rd-place playoff between the semi-final losers
  const sfLoser = (n: PlannedNode | null) =>
    n && n.isContest && n.match ? n.match.loserName : null;
  const l1 = sfLoser(root.feed1);
  const l2 = sfLoser(root.feed2);
  let thirdPlaceMatch: EnrichedMatch | null = null;
  let thirdPlacePending: [string, string] | null = null;
  if (l1 && l2) {
    thirdPlaceMatch = takeMatch(l1, l2);
    if (thirdPlaceMatch) roundOf.set(thirdPlaceMatch.id, "3rd place");
    else thirdPlacePending = [l1, l2];
  }

  const final = root.isContest ? root.match : null;
  const players = [
    ...new Set([
      ...draw.filter((s): s is string => Boolean(s)),
      ...ordered.flatMap((m) => [m.player1, m.player2]),
    ]),
  ];

  return {
    matches: ordered,
    players,
    final,
    thirdPlaceMatch,
    thirdPlacePending,
    champion: final ? final.winnerName : null,
    runnerUp: final ? final.loserName : null,
    thirdPlace: thirdPlaceMatch ? thirdPlaceMatch.winnerName : null,
    bracket: null,
    planned: root,
    maxDepth,
    roundOf,
  };
}

/* ---------------- derived mode ---------------- */

function analyzeDerived(ordered: EnrichedMatch[]): TournamentAnalysis {
  const players = [...new Set(ordered.flatMap((m) => [m.player1, m.player2]))];

  // Split off the 3rd-place playoff: the match between two already-eliminated players
  const losses = new Map<string, number>();
  let thirdPlaceMatch: EnrichedMatch | null = null;
  const main: EnrichedMatch[] = [];
  for (const m of ordered) {
    const l1 = losses.get(m.player1) ?? 0;
    const l2 = losses.get(m.player2) ?? 0;
    if (l1 > 0 && l2 > 0) thirdPlaceMatch = m;
    else main.push(m);
    losses.set(m.loserName, (losses.get(m.loserName) ?? 0) + 1);
  }

  const final = main.length ? main[main.length - 1] : null;

  // Build the tree backwards from the final
  const prevOf = (player: string, beforeSeq: number): EnrichedMatch | null => {
    for (let i = main.length - 1; i >= 0; i--) {
      const m = main[i];
      if (m.seq >= beforeSeq) continue;
      if (m.player1 === player || m.player2 === player) return m;
    }
    return null;
  };

  let maxDepth = 0;
  const build = (m: EnrichedMatch, depth: number): BracketNode => {
    maxDepth = Math.max(maxDepth, depth);
    const p1Prev = prevOf(m.player1, m.seq);
    const p2Prev = prevOf(m.player2, m.seq);
    return {
      match: m,
      depth,
      feed1: p1Prev ? build(p1Prev, depth + 1) : null,
      feed2: p2Prev ? build(p2Prev, depth + 1) : null,
    };
  };
  const bracket = final ? build(final, 0) : null;

  const roundOf = new Map<string, string>();
  const walk = (n: BracketNode | null) => {
    if (!n) return;
    roundOf.set(n.match.id, roundLabel(n.depth, maxDepth));
    walk(n.feed1);
    walk(n.feed2);
  };
  walk(bracket);
  if (thirdPlaceMatch) roundOf.set(thirdPlaceMatch.id, "3rd place");

  return {
    matches: ordered,
    players,
    final,
    thirdPlaceMatch,
    thirdPlacePending: null,
    champion: final ? final.winnerName : null,
    runnerUp: final ? final.loserName : null,
    thirdPlace: thirdPlaceMatch ? thirdPlaceMatch.winnerName : null,
    bracket,
    planned: null,
    maxDepth,
    roundOf,
  };
}
