// One-off migration: create the players table (profile photos) with RLS.
// Usage: node scripts/migrate-players.mjs <supabase-access-token>
//   (or set SUPABASE_ACCESS_TOKEN in the environment)

const PROJECT_REF = "relzupxewubsuueesvoy";
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Provide a Supabase access token (argv or SUPABASE_ACCESS_TOKEN).");
  process.exit(1);
}

const SQL = `
create table if not exists public.players (
  name text primary key,
  avatar text,
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;

drop policy if exists "players are public to read" on public.players;
create policy "players are public to read"
  on public.players for select
  using (true);

drop policy if exists "admins can insert players" on public.players;
create policy "admins can insert players"
  on public.players for insert
  with check (public.is_admin());

drop policy if exists "admins can update players" on public.players;
create policy "admins can update players"
  on public.players for update
  using (public.is_admin());

drop policy if exists "admins can delete players" on public.players;
create policy "admins can delete players"
  on public.players for delete
  using (public.is_admin());

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
