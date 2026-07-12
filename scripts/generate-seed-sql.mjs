// Generates supabase/seed.sql from src/data/seed-matches.json
// Run: npm run gen:seed-sql
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rows = JSON.parse(
  readFileSync(join(root, "src", "data", "seed-matches.json"), "utf8"),
);

const esc = (s) => String(s).replaceAll("'", "''");
const lit = (v) => (v == null ? "null" : `'${esc(v)}'`);

const values = rows
  .map(
    (r, i) =>
      `(${i + 1}, '${esc(r[0])}', '${esc(r[1])}', '${esc(r[2])}', ${r[3]}, ${lit(r[4])}, ${lit(r[5])})`,
  )
  .join(",\n");

const sql = `-- Auto-generated from src/data/seed-matches.json — do not edit by hand.
-- Loads the historical match log into Supabase. Safe to run once on an empty table.
insert into public.matches (seq, date, player1, player2, winner, score, tournament)
values
${values}
on conflict (seq) do nothing;

-- keep the identity counter ahead of the seeded rows
select setval(
  pg_get_serial_sequence('public.matches', 'seq'),
  (select max(seq) from public.matches)
);
`;

mkdirSync(join(root, "supabase"), { recursive: true });
writeFileSync(join(root, "supabase", "seed.sql"), sql);
console.log(`Wrote supabase/seed.sql with ${rows.length} matches`);
