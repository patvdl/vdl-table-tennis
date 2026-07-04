import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { formatDate, round0, pct } from "../lib/format";
import type { PlayerStats } from "../types";
import Sparkline from "../components/Sparkline";
import StreakBadge from "../components/StreakBadge";

type SortKey =
  | "name"
  | "rating"
  | "peak"
  | "played"
  | "wins"
  | "losses"
  | "winpct"
  | "streak"
  | "last";

const DEFAULT_DIR: Record<SortKey, 1 | -1> = {
  name: 1, // alphabetical
  rating: -1,
  peak: -1,
  played: -1,
  wins: -1,
  losses: -1,
  winpct: -1,
  streak: -1,
  last: -1, // most recent first
};

function sortValue(p: PlayerStats, key: SortKey): string | number {
  switch (key) {
    case "name":
      return p.name.toLowerCase();
    case "rating":
      return p.rating;
    case "peak":
      return p.peakRating;
    case "played":
      return p.played;
    case "wins":
      return p.wins;
    case "losses":
      return p.losses;
    case "winpct":
      return p.played ? p.wins / p.played : -1;
    case "streak":
      return p.streak;
    case "last":
      return p.lastPlayed ?? "";
  }
}

export default function Leaderboard() {
  const { board, matches } = useMatches();
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [dir, setDir] = useState<1 | -1>(-1);

  // Rank is always rating-based, regardless of the active sort
  const ratingRank = useMemo(() => {
    const m = new Map<string, number>();
    board.forEach((p, i) => m.set(p.name, i + 1));
    return m;
  }, [board]);

  const sorted = useMemo(() => {
    const arr = [...board];
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : va - (vb as number);
      // stable tie-break on rating so equal values keep a sensible order
      return dir * cmp || b.rating - a.rating;
    });
    return arr;
  }, [board, sortKey, dir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setDir(DEFAULT_DIR[key]);
    }
  };

  const Th = ({
    k,
    label,
    numeric,
  }: {
    k: SortKey;
    label: string;
    numeric?: boolean;
  }) => (
    <th
      className={`sortable${numeric ? " num" : ""}${sortKey === k ? " sorted" : ""}`}
      onClick={() => onSort(k)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <span className="sort-arrow">
        {sortKey === k ? (dir === -1 ? "▼" : "▲") : ""}
      </span>
    </th>
  );

  return (
    <div className="card">
      <h2>Leaderboard</h2>
      <p className="sub">
        {board.length} players · {matches.length} matches recorded · click a column
        to sort
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank-cell">#</th>
              <Th k="name" label="Player" />
              <Th k="rating" label="Rating" numeric />
              <Th k="peak" label="Peak" numeric />
              <Th k="played" label="Played" numeric />
              <Th k="wins" label="W" numeric />
              <Th k="losses" label="L" numeric />
              <Th k="winpct" label="Win %" numeric />
              <Th k="streak" label="Streak" />
              <th>Form</th>
              <Th k="last" label="Last played" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const rank = ratingRank.get(p.name)!;
              return (
                <tr key={p.name}>
                  <td className={`rank-cell rank-${rank}`}>{rank}</td>
                  <td>
                    <Link
                      className="player-link"
                      to={`/player/${encodeURIComponent(p.name)}`}
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="num rating">{round0(p.rating)}</td>
                  <td className="num" style={{ color: "var(--text-dim)" }}>
                    {round0(p.peakRating)}
                  </td>
                  <td className="num">{p.played}</td>
                  <td className="num" style={{ color: "var(--green)" }}>
                    {p.wins}
                  </td>
                  <td className="num" style={{ color: "var(--red)" }}>
                    {p.losses}
                  </td>
                  <td className="num">{p.played ? pct(p.wins / p.played) : "—"}</td>
                  <td>
                    <StreakBadge streak={p.streak} />
                  </td>
                  <td>
                    <Sparkline values={p.history.slice(-20)} />
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {formatDate(p.lastPlayed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
