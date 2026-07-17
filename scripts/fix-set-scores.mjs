// One-off cleanup: normalize "3-2 sets" style scores to plain "3-2".
// Usage: node scripts/fix-set-scores.mjs <supabase-access-token>
//   (or set SUPABASE_ACCESS_TOKEN in the environment)

const PROJECT_REF = "relzupxewubsuueesvoy";
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Provide a Supabase access token (argv or SUPABASE_ACCESS_TOKEN).");
  process.exit(1);
}

const SQL = `
update public.matches
  set score = regexp_replace(score, '\\s*sets?$', '', 'i')
  where score ~* '\\s*sets?$';

select id, date, player1, player2, score, tournament
  from public.matches
  where tournament is not null
  order by date, id;
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
console.log("Scores normalized. Tournament matches now:", text);
