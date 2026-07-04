# VDL Table Tennis

Family table tennis ratings site: ELO leaderboard, full match history, and detailed
head-to-head stats. Built with React + Vite, backed by Supabase, deployed on GitHub Pages.

## How the ratings work

- Everyone starts at **1000**. Ratings are replayed from the complete match log, so
  the entire history stays consistent if a match is added or removed.
- The expected result uses the classic ELO 400-point curve: the bigger the rating gap,
  the less the favourite gains for winning and the more they lose for an upset.
- Beating a much lower-ranked player still always earns a little — ten wins in a row
  adds up — while an upset win pays out much more.
- New players use a higher K-factor (40) for their first 10 matches so they settle
  quickly; established players use K=24.
- **Scores are stored for the record only. They never affect ELO** — only who won.

## Running locally

```bash
npm install
npm run dev
```

Without Supabase configured the site runs in **local demo mode**: the full historical
match log is loaded into your browser's local storage, and you can toggle "admin" in
the header to try adding matches. Nothing is shared between devices in this mode.

## Setting up Supabase (shared data + real admin accounts)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql` (creates tables, roles, security policies).
3. Run `npm run gen:seed-sql`, then run the generated `supabase/seed.sql` in the SQL
   Editor to import the historical matches.
4. Copy `.env.example` to `.env` and fill in your project URL and anon key
   (Dashboard → Settings → API).
5. Invite users: Dashboard → Authentication → Users → *Add user*. Everyone starts as a
   viewer. Promote admins with:

   ```sql
   update public.profiles set role = 'admin' where email = 'person@example.com';
   ```

Viewing the site requires no account at all — anyone with the link can browse the
leaderboard, history and head-to-heads. Only admins can record or delete matches
(enforced server-side by row-level security, not just in the UI).

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Repo → Settings → Secrets and variables → Actions → **Variables** tab: add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Push to `main` — the included workflow builds and publishes automatically.

The anon key is safe to expose in a public site: it only grants what the row-level
security policies allow (public read, admin-only writes).

## Project layout

- `src/lib/elo.ts` — rating engine (replay, expected scores, head-to-head maths)
- `src/data/seed-matches.json` — historical match log imported from the original spreadsheet
- `src/store/` — data access (Supabase or local demo) + auth/role context
- `src/pages/` — Leaderboard, Head-to-Head, Match History, Add Match, Player profile
- `supabase/schema.sql` — database schema, triggers and security policies
- `.github/workflows/deploy.yml` — GitHub Pages deployment
