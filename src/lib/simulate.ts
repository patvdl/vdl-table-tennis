import type { EnrichedMatch, PlayerStats } from "../types";
import type { PlannedNode } from "./bracket";
import { predictMatch } from "./elo";

/**
 * Tournament crystal ball: Monte Carlo simulation of a planned bracket.
 *
 * Recorded results are locked in; every remaining contest is sampled from
 * the site's win predictor (rating + form + head-to-head, evaluated on
 * today's numbers). Byes walk over, semi-final losers meet in the
 * 3rd-place playoff. Running thousands of tournaments gives each player's
 * chance of the title, of reaching the final, and of a podium finish.
 */

export interface SimOutcome {
  player: string;
  /** Probability of winning the tournament */
  title: number;
  /** Probability of reaching the final */
  final: number;
  /** Probability of finishing top 3 (champion, runner-up or 3rd place) */
  podium: number;
}

export interface PendingContest {
  a: string;
  b: string;
  depth: number;
}

/** Unplayed pairings where both players are already known, earliest rounds first */
export function pendingContests(root: PlannedNode | null): PendingContest[] {
  const out: PendingContest[] = [];
  const walk = (n: PlannedNode | null) => {
    if (!n || n.isDead) return;
    walk(n.feed1);
    walk(n.feed2);
    if (n.isContest && !n.match && n.player1 && n.player2) {
      out.push({ a: n.player1, b: n.player2, depth: n.depth });
    }
  };
  walk(root);
  return out.sort((x, y) => y.depth - x.depth);
}

const ITERATIONS = 5000;

export function simulateTournament(
  root: PlannedNode,
  thirdPlaceMatch: EnrichedMatch | null,
  players: string[],
  enriched: EnrichedMatch[],
  stats: Map<string, PlayerStats>,
): SimOutcome[] {
  // Pairwise win probabilities from the predictor, cached per matchup
  const probCache = new Map<string, number>();
  const prob = (a: string, b: string): number => {
    const key = `${a}|${b}`;
    let p = probCache.get(key);
    if (p === undefined) {
      p = predictMatch(enriched, stats, a, b).pA;
      probCache.set(key, p);
      probCache.set(`${b}|${a}`, 1 - p);
    }
    return p;
  };

  const titles = new Map<string, number>();
  const finals = new Map<string, number>();
  const podiums = new Map<string, number>();
  const bump = (map: Map<string, number>, name: string | null) => {
    if (name) map.set(name, (map.get(name) ?? 0) + 1);
  };

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const semiLosers: string[] = [];
    let finalists: [string | null, string | null] = [null, null];

    const play = (node: PlannedNode | null): string | null => {
      if (!node || node.isDead) return null;
      const p1 = node.feed1 ? play(node.feed1) : node.player1;
      const p2 = node.feed2 ? play(node.feed2) : node.player2;
      if (node.depth === 0) finalists = [p1, p2];
      let winner: string | null;
      if (!p1 || !p2) winner = p1 ?? p2;
      else if (node.match) winner = node.match.winnerName;
      else winner = Math.random() < prob(p1, p2) ? p1 : p2;
      if (node.depth === 1 && p1 && p2 && winner) {
        semiLosers.push(winner === p1 ? p2 : p1);
      }
      return winner;
    };

    const champion = play(root);
    const runnerUp =
      finalists[0] === champion ? finalists[1] : finalists[0];

    let third: string | null = null;
    if (thirdPlaceMatch) third = thirdPlaceMatch.winnerName;
    else if (semiLosers.length === 2) {
      third =
        Math.random() < prob(semiLosers[0], semiLosers[1])
          ? semiLosers[0]
          : semiLosers[1];
    }

    bump(titles, champion);
    bump(finals, finalists[0]);
    bump(finals, finalists[1]);
    bump(podiums, champion);
    bump(podiums, runnerUp);
    bump(podiums, third);
  }

  return players
    .map((p) => ({
      player: p,
      title: (titles.get(p) ?? 0) / ITERATIONS,
      final: (finals.get(p) ?? 0) / ITERATIONS,
      podium: (podiums.get(p) ?? 0) / ITERATIONS,
    }))
    .sort(
      (a, b) => b.title - a.title || b.final - a.final || b.podium - a.podium,
    );
}
