/**
 * Sanity harness for the tournament predictor (run: npx tsx scripts/test-predictor.ts).
 * Replays the real seed data, builds a hypothetical 8-slot bracket, and checks
 * that pendingContests + simulateTournament behave: probabilities sum correctly,
 * byes walk over, and recorded results are locked in.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { replay } from "../src/lib/elo";
import { analyzeTournament } from "../src/lib/bracket";
import { pendingContests, simulateTournament } from "../src/lib/simulate";
import type { Match } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
type SeedRow = [string, string, string, number, (string | null)?, (string | null)?];
const rows: SeedRow[] = JSON.parse(
  readFileSync(join(here, "../src/data/seed-matches.json"), "utf8"),
);

const matches: Match[] = rows.map((r, i) => ({
  id: `seed-${i}`,
  seq: i + 1,
  date: r[0],
  player1: r[1],
  player2: r[2],
  winner: r[3] as 1 | 2,
  score: r[4] ?? null,
  tournament: r[5] ?? null,
}));

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const { stats, enriched } = replay(matches);

// Hypothetical Christmas draw: 7 players + 1 bye (Patrick gets the free pass)
const draw = ["Patrick", null, "Riley", "Tim", "Marcus", "Paul", "Simon", "Dad"];

// --- fresh bracket, nothing played -------------------------------------
{
  const a = analyzeTournament([], draw);
  const pending = pendingContests(a.planned);
  check(
    "3 round-1 contests pending (bye skipped)",
    pending.length === 3,
    pending.map((c) => `${c.a} v ${c.b}`).join(", "),
  );

  const out = simulateTournament(a.planned!, a.thirdPlaceMatch, a.players, enriched, stats);
  const sum = (k: "title" | "final" | "podium") => out.reduce((s, o) => s + o[k], 0);
  check("title probabilities sum to 1", Math.abs(sum("title") - 1) < 0.001, sum("title").toFixed(4));
  check("final probabilities sum to 2", Math.abs(sum("final") - 2) < 0.001, sum("final").toFixed(4));
  check("podium probabilities sum to 3", Math.abs(sum("podium") - 3) < 0.01, sum("podium").toFixed(4));
  check("every entrant can reach the final", out.every((o) => o.final > 0));

  // Simon leads Patrick 3-1 in their h2h, so the two of them should sit
  // clearly on top (order between them is the predictor's call).
  const topTwo = [out[0].player, out[1].player].sort().join("+");
  check("Patrick and Simon are the top two title chances", topTwo === "Patrick+Simon", topTwo);
  const patrick = out.find((o) => o.player === "Patrick")!;
  check(
    "bye player has the best podium odds (free pass to the semis)",
    out.every((o) => o.podium <= patrick.podium),
    `podium ${Math.round(patrick.podium * 100)}%`,
  );
  console.log(
    "  outcomes:",
    out
      .map((o) => `${o.player} T${Math.round(o.title * 100)}% F${Math.round(o.final * 100)}% P${Math.round(o.podium * 100)}%`)
      .join(" · "),
  );
}

// --- one result recorded: Tim upsets Riley in round 1 -------------------
{
  const extra: Match = {
    id: "t-r1",
    seq: matches.length + 1,
    date: "2026-07-28",
    player1: "Tim",
    player2: "Riley",
    winner: 1,
    score: "3-2",
    tournament: "Test Cup",
  };
  const rr = replay([...matches, extra]);
  const tMatches = rr.enriched.filter((m) => m.tournament === "Test Cup");
  const a = analyzeTournament(tMatches, draw);
  const pending = pendingContests(a.planned);
  check(
    "played contest no longer pending, semi appears",
    pending.length === 3 &&
      pending.some((c) => (c.a === "Patrick" && c.b === "Tim") || (c.a === "Tim" && c.b === "Patrick")),
    pending.map((c) => `${c.a} v ${c.b}`).join(", "),
  );

  const out = simulateTournament(a.planned!, a.thirdPlaceMatch, a.players, rr.enriched, rr.stats);
  const riley = out.find((o) => o.player === "Riley")!;
  check("eliminated player can't win or make the final", riley.title === 0 && riley.final === 0);
  check(
    "quarter-final loser can't podium (3rd-place game is for semi losers)",
    riley.podium === 0,
  );
  const tim = out.find((o) => o.player === "Tim")!;
  check("winner advanced (Tim final chance > 0)", tim.final > 0, `final ${Math.round(tim.final * 100)}%`);
}

// --- semi-final loser goes to the 3rd-place game ------------------------
{
  const extras: Match[] = [
    // Quarters
    { id: "q1", seq: matches.length + 1, date: "2026-07-28", player1: "Tim", player2: "Riley", winner: 1, score: "3-2", tournament: "Test Cup" },
    { id: "q2", seq: matches.length + 2, date: "2026-07-28", player1: "Marcus", player2: "Paul", winner: 1, score: "3-0", tournament: "Test Cup" },
    { id: "q3", seq: matches.length + 3, date: "2026-07-28", player1: "Simon", player2: "Dad", winner: 1, score: "3-1", tournament: "Test Cup" },
    // Semi 1: Patrick beats Tim -> Tim is a semi-final loser
    { id: "s1", seq: matches.length + 4, date: "2026-07-28", player1: "Patrick", player2: "Tim", winner: 1, score: "3-0", tournament: "Test Cup" },
  ];
  const rr = replay([...matches, ...extras]);
  const tMatches = rr.enriched.filter((m) => m.tournament === "Test Cup");
  const a = analyzeTournament(tMatches, draw);
  const out = simulateTournament(a.planned!, a.thirdPlaceMatch, a.players, rr.enriched, rr.stats);
  const tim = out.find((o) => o.player === "Tim")!;
  check(
    "semi-final loser keeps a podium shot but no title",
    tim.title === 0 && tim.final === 0 && tim.podium > 0,
    `podium ${Math.round(tim.podium * 100)}%`,
  );
  const patrick = out.find((o) => o.player === "Patrick")!;
  check("finalist is guaranteed the final", patrick.final === 1, `final ${Math.round(patrick.final * 100)}%`);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
