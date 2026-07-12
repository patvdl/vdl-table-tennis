// One-off migration: create the tournaments table on the live Supabase project.
// Usage: node scripts/migrate-tournaments.mjs <supabase-access-token>
//   (or set SUPABASE_ACCESS_TOKEN in the environment)

const PROJECT_REF = "relzupxewubsuueesvoy";
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Provide a Supabase access token (argv or SUPABASE_ACCESS_TOKEN).");
  process.exit(1);
}

const SQL = `
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  date date not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

insert into public.tournaments (name, date, status) values
  ('Christmas 2024', '2024-12-25', 'completed'),
  ('Christmas 2025', '2025-12-25', 'completed')
on conflict (name) do nothing;

alter table public.tournaments enable row level security;

drop policy if exists "tournaments are public to read" on public.tournaments;
create policy "tournaments are public to read"
  on public.tournaments for select
  using (true);

drop policy if exists "admins can insert tournaments" on public.tournaments;
create policy "admins can insert tournaments"
  on public.tournaments for insert
  with check (public.is_admin());

drop policy if exists "admins can update tournaments" on public.tournaments;
create policy "admins can update tournaments"
  on public.tournaments for update
  using (public.is_admin());

drop policy if exists "admins can delete tournaments" on public.tournaments;
create policy "admins can delete tournaments"
  on public.tournaments for delete
  using (public.is_admin());

select name, date, status from public.tournaments order by date;
`;

async function query(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text;
}

console.log("Applying tournaments migration…");
const out = await query(SQL);
console.log("Done. Result:", out);
