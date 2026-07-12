import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { useAuth } from "../store/auth";
import { formatDate, round0, signed } from "../lib/format";

const PAGE = 50;

export default function MatchHistory() {
  const { replayResult, playerNames, removeMatch } = useMatches();
  const { role } = useAuth();
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = [...replayResult.enriched].reverse(); // newest first
    if (!filter) return all;
    return all.filter((m) => m.player1 === filter || m.player2 === filter);
  }, [replayResult, filter]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this match? Ratings will be recalculated.")) return;
    setBusy(id);
    try {
      await removeMatch(id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <h2>Match History</h2>
      <p className="sub">Every match ever recorded, newest first. ELO shifts shown per match.</p>

      <div style={{ maxWidth: 280, marginBottom: 16 }}>
        <label className="field">Filter by player</label>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setShown(PAGE);
          }}
        >
          <option value="">All players</option>
          {playerNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Date</th>
              <th>Winner</th>
              <th>Loser</th>
              <th>Score</th>
              <th className="num">ELO +/-</th>
              <th className="num">Winner rating</th>
              <th className="num">Loser rating</th>
              {role === "admin" && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((m) => {
              const winnerAfter = m.winner === 1 ? m.rating1After : m.rating2After;
              const loserAfter = m.winner === 1 ? m.rating2After : m.rating1After;
              return (
                <tr key={m.id}>
                  <td className="num" style={{ color: "var(--text-dim)" }}>
                    {m.seq}
                  </td>
                  <td>{formatDate(m.date)}</td>
                  <td>
                    <Link className="player-link" to={`/player/${encodeURIComponent(m.winnerName)}`} style={{ color: "var(--green)" }}>
                      {m.winnerName}
                    </Link>
                  </td>
                  <td>
                    <Link className="player-link" to={`/player/${encodeURIComponent(m.loserName)}`} style={{ color: "var(--red)" }}>
                      {m.loserName}
                    </Link>
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {m.score ?? "—"}
                    {m.tournament && (
                      <span className="badge gold" style={{ marginLeft: 8, fontSize: 11 }}>
                        🏆 {m.tournament}
                      </span>
                    )}
                  </td>
                  <td className="num delta-up">{signed(Math.abs(m.delta))}</td>
                  <td className="num rating">{round0(winnerAfter)}</td>
                  <td className="num rating">{round0(loserAfter)}</td>
                  {role === "admin" && (
                    <td>
                      <button
                        className="btn danger"
                        disabled={busy === m.id}
                        onClick={() => onDelete(m.id)}
                      >
                        {busy === m.id ? "…" : "Delete"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {shown < rows.length && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="btn ghost" onClick={() => setShown((s) => s + PAGE)}>
            Show more ({rows.length - shown} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
