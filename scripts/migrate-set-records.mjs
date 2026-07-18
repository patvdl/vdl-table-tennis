// One-off migration: create the set_records table (longest set played record).
// Usage: node scripts/migrate-set-records.mjs <supabase-access-token>
//   (or set SUPABASE_ACCESS_TOKEN in the environment)

const PROJECT_REF = "relzupxewubsuueesvoy";
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Provide a Supabase access token (argv or SUPABASE_ACCESS_TOKEN).");
  process.exit(1);
}

const SQL = `
create table if not exists public.set_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  winner text not null,
  loser text not null,
  score text not null,
  created_at timestamptz not null default now()
);

alter table public.set_records enable row level security;

drop policy if exists "set records are public to read" on public.set_records;
create policy "set records are public to read"
  on public.set_records for select
  using (true);

drop policy if exists "admins can insert set records" on public.set_records;
create policy "admins can insert set records"
  on public.set_records for insert
  with check (public.is_admin());

drop policy if exists "admins can delete set records" on public.set_records;
create policy "admins can delete set records"
  on public.set_records for delete
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
