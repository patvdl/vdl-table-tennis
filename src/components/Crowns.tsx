import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { seasonsFor } from "../lib/records";
import Crown from "./Crown";

/**
 * Player-of-the-year crowns, the counterpart of the champion Trophy:
 * gold for the reigning player of the year, grey for past winners.
 * Clicking a crown opens the Records page at that season. Only completed
 * years count — the current season's leader hasn't won anything yet.
 * Pass `asOf` (YYYY-MM-DD) to only count years finished by that date.
 */
export default function Crowns({ player, asOf }: { player: string; asOf?: string }) {
  const { replayResult } = useMatches();
  const viewingYear = asOf ? Number(asOf.slice(0, 4)) : new Date().getFullYear();

  // Newest first, completed years only
  const decided = seasonsFor(replayResult.enriched)
    .filter((s) => s.year < viewingYear && s.winner)
    .sort((a, b) => b.year - a.year);
  const titles = decided.filter((s) => s.winner!.player === player);
  if (titles.length === 0) return null;

  const defending = decided[0]?.winner!.player === player;
  const color = defending ? "var(--gold)" : "var(--text-dim)";
  const years = titles.map((t) => t.year).join(", ");
  const label = defending
    ? `Reigning player of the year (${years})`
    : `Past player of the year (${years})`;

  return (
    <Link
      to={`/records?year=${titles[0].year}`}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        verticalAlign: "-2px",
        marginLeft: 6,
        textDecoration: "none",
      }}
    >
      <Crown size={15} title={label} color={color} />
      {titles.length > 1 && (
        <span style={{ fontSize: 10, fontWeight: 800, color }}>×{titles.length}</span>
      )}
    </Link>
  );
}
