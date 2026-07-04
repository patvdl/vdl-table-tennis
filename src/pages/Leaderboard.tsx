import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { formatDate, round0, pct } from "../lib/format";
import Sparkline from "../components/Sparkline";
import StreakBadge from "../components/StreakBadge";

export default function Leaderboard() {
  const { board, matches } = useMatches();

  return (
    <div className="card">
      <h2>Leaderboard</h2>
      <p className="sub">
        {board.length} players · {matches.length} matches recorded · ratings replayed
        from full match history
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank-cell">#</th>
              <th>Player</th>
              <th className="num">Rating</th>
              <th className="num">Peak</th>
              <th className="num">Played</th>
              <th className="num">W</th>
              <th className="num">L</th>
              <th className="num">Win %</th>
              <th>Streak</th>
              <th>Form</th>
              <th>Last played</th>
            </tr>
          </thead>
          <tbody>
            {board.map((p, i) => (
              <tr key={p.name}>
                <td className={`rank-cell rank-${i + 1}`}>{i + 1}</td>
                <td>
                  <Link className="player-link" to={`/player/${encodeURIComponent(p.name)}`}>
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
                <td style={{ color: "var(--text-dim)" }}>{formatDate(p.lastPlayed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
