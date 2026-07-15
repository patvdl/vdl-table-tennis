// One-off migration: create the deleted_players table (30-day restore window).
// Usage: node scripts/migrate-trash.mjs <supabase-access-token>
//   (or set SUPABASE_ACCESS_TOKEN in the environment)

const PROJECT_REF = "relzupxewubsuueesvoy";
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Provide a Supabase access token (argv or SUPABASE_ACCESS_TOKEN).");
  process.exit(1);
}

const SQL = `
create table if not exists public.deleted_players (
  name text primary key,
  avatar text,
  matches jsonb not null default '[]'::jsonb,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_players enable row level security;

drop policy if exists "admins manage deleted players" on public.deleted_players;
create policy "admins manage deleted players"
  on public.deleted_players for all
  using (public.is_admin())
  with check (public.is_admin());

select tablename from pg_tables where schemaname = 'public' order by tablename;
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
console.log("Migration applied. Tables:", text);
