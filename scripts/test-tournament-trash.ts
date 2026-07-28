/**
 * Sanity harness for tournament delete/restore (run: npx tsx scripts/test-tournament-trash.ts).
 * Exercises the real local store: deleting a tournament removes its matches,
 * parks everything in the trash, and restoring brings it all back — including
 * re-slotting matches whose seq numbers were reused while they were deleted.
 */

// The local store runs on localStorage; give node an in-memory one
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size;
  },
} as Storage;

const { store } = await import("../src/store/store");

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// --- small hand-made log: 3 casual matches, then a 2-match tournament ---
const mk = (seq: number, p1: string, p2: string, tournament: string | null) => ({
  id: `m-${seq}`,
  seq,
  date: "2026-07-01",
  player1: p1,
  player2: p2,
  winner: 1 as const,
  score: null,
  tournament,
});
localStorage.setItem(
  "vdl-tt-matches-v2",
  JSON.stringify([
    mk(1, "A", "B", null),
    mk(2, "C", "D", null),
    mk(3, "A", "C", null),
    mk(4, "A", "D", "Test Cup"),
    mk(5, "B", "C", "Test Cup"),
  ]),
);
localStorage.setItem(
  "vdl-tt-tournaments-v1",
  JSON.stringify([
    { id: "t-1", name: "Test Cup", date: "2026-07-01", status: "active", bracket: ["A", "D", "B", "C"] },
  ]),
);

// --- delete: cascade + trash ---
await store.removeTournament("t-1");
let matches = await store.load();
check("delete removes the tournament's matches", matches.length === 3);
check("other matches untouched", matches.every((m) => m.tournament === null));
check("tournament row gone", (await store.loadTournaments()).length === 0);

let trash = await store.loadTournamentTrash();
check("trash holds one entry", trash.length === 1);
check(
  "trash entry has name/date/matchCount",
  trash[0]?.name === "Test Cup" && trash[0]?.date === "2026-07-01" && trash[0]?.matchCount === 2,
);

// --- reuse the freed seq numbers, then restore ---
await store.add({ date: "2026-07-02", player1: "B", player2: "D", winner: 1, score: null, tournament: null });
await store.add({ date: "2026-07-02", player1: "C", player2: "A", winner: 2, score: null, tournament: null });
matches = await store.load();
check(
  "new matches reused seqs 4 and 5",
  matches.some((m) => m.seq === 4 && m.player1 === "B") &&
    matches.some((m) => m.seq === 5 && m.player1 === "C"),
);

await store.restoreTournament("Test Cup");
matches = await store.load();
const seqs = matches.map((m) => m.seq);
check("all 7 matches back", matches.length === 7);
check("no duplicate seqs after restore", new Set(seqs).size === seqs.length);
const restored = matches.filter((m) => m.tournament === "Test Cup").sort((a, b) => a.seq - b.seq);
check(
  "restored matches re-slotted at the end in original order",
  restored.length === 2 &&
    restored[0].id === "m-4" &&
    restored[1].id === "m-5" &&
    restored[0].seq > 5,
);
const ts = await store.loadTournaments();
check(
  "tournament row restored verbatim",
  ts.length === 1 &&
    ts[0].id === "t-1" &&
    ts[0].status === "active" &&
    JSON.stringify(ts[0].bracket) === JSON.stringify(["A", "D", "B", "C"]),
);
check("trash empty after restore", (await store.loadTournamentTrash()).length === 0);

// --- restore blocked by a name clash ---
await store.removeTournament("t-1");
await store.addTournament("Test Cup", "2026-08-01");
let clashError = "";
try {
  await store.restoreTournament("Test Cup");
} catch (e) {
  clashError = e instanceof Error ? e.message : String(e);
}
check("restore refuses when the name is taken", clashError.includes("already exists"), clashError);

// --- purge is permanent ---
await store.purgeDeletedTournament("Test Cup");
check("purge empties the trash", (await store.loadTournamentTrash()).length === 0);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
