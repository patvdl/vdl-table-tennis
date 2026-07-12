import type { EnrichedMatch } from "../types";

/**
 * Reconstructs a single-elimination bracket from a tournament's matches.
 *
 * The structure is derived, not stored: matches are replayed in the order
 * they were recorded. Every loss eliminates a player, so a match where
 * both players have already lost is the 3rd-place playoff, and the last
 * main-draw match is the final. Rounds are then walked backwards from
 * the final (a player's previous tournament match feeds their slot; a
 * player with no earlier match entered on a bye).
 */

export interface BracketNode {
  match: EnrichedMatch;
  /** Depth from the final: 0 = final, 1 = semi, 2 = quarter... */
  depth: number;
  /** Feeder for player1/player2 — an earlier match, or null (bye / direct entry) */
  feed1: BracketNode | null;
  feed2: BracketNode | null;
}

export interface TournamentAnalysis {
  matches: EnrichedMatch[];
  players: string[];
  final: EnrichedMatch | null;
  thirdPlaceMatch: EnrichedMatch | null;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  /** Root of the bracket tree (the final). Null when it can't be derived. */
  bracket: BracketNode | null;
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

export function analyzeTournament(tMatches: EnrichedMatch[]): TournamentAnalysis {
  const ordered = [...tMatches].sort((a, b) => a.seq - b.seq);
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
    champion: final ? final.winnerName : null,
    runnerUp: final ? final.loserName : null,
    thirdPlace: thirdPlaceMatch ? thirdPlaceMatch.winnerName : null,
    bracket,
    maxDepth,
    roundOf,
  };
}
