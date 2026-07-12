// One-off migration: add the bracket (planned draw) column to tournaments.
// Usage: node scripts/migrate-bracket.mjs <supabase-access-token>
//   (or set SUPABASE_ACCESS_TOKEN in the environment)

const PROJECT_REF = "relzupxewubsuueesvoy";
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Provide a Supabase access token (argv or SUPABASE_ACCESS_TOKEN).");
  process.exit(1);
}

const SQL = `
alter table public.tournaments add column if not exists bracket jsonb;
select column_name, data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'tournaments' order by ordinal_position;
`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SQL }),
  },
);
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text}`);
  process.exit(1);
}
console.log("Migration applied. Columns:", text);
