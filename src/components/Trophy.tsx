import { useMatches } from "../store/matches";

/**
 * Small trophy icon: gold for the defending champion, grey for past champions.
 * Pass `asOf` (YYYY-MM-DD) to only count tournaments decided by that date,
 * e.g. for the leaderboard time machine.
 */
export default function Trophy({ player, asOf }: { player: string; asOf?: string }) {
  const { tournaments } = useMatches();
  // Newest first; only completed tournaments have a champion
  const decided = tournaments.filter(
    (t) => t.champion && (!asOf || t.date <= asOf),
  );
  const titles = decided.filter((t) => t.champion === player);
  if (titles.length === 0) return null;

  const defending = decided[0]?.champion === player;
  const color = defending ? "var(--gold)" : "var(--text-dim)";
  const label = defending
    ? `Defending champion — ${titles[0].name}${titles.length > 1 ? ` (also won: ${titles.slice(1).map((t) => t.name).join(", ")})` : ""}`
    : `Past champion — ${titles.map((t) => t.name).join(", ")}`;

  return (
    <span title={label} style={{ display: "inline-flex", alignItems: "center", gap: 2, verticalAlign: "-2px", marginLeft: 6 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill={color} aria-label={label}>
        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
      </svg>
      {titles.length > 1 && (
        <span style={{ fontSize: 10, fontWeight: 800, color }}>×{titles.length}</span>
      )}
    </span>
  );
}
