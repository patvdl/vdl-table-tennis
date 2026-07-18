import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { useAuth } from "../store/auth";
import { formatDate, round0 } from "../lib/format";
import type { EnrichedMatch } from "../types";
import Delta from "../components/Delta";
import PlayerName from "../components/PlayerName";

const PAGE = 50;

export default function MatchHistory() {
  const { replayResult, playerNames, removeMatch, moveMatch } = useMatches();
  const { role } = useAuth();
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState<EnrichedMatch | null>(null);

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
              const winnerDelta =
                m.winner === 1
                  ? m.rating1After - m.rating1Before
                  : m.rating2After - m.rating2Before;
              const loserDelta =
                m.winner === 1
                  ? m.rating2After - m.rating2Before
                  : m.rating1After - m.rating1Before;
              return (
                <tr key={m.id}>
                  <td className="num" style={{ color: "var(--text-dim)" }}>
                    {m.seq}
                  </td>
                  <td>{formatDate(m.date)}</td>
                  <td>
                    <Link className="player-link" to={`/player/${encodeURIComponent(m.winnerName)}`} style={{ color: "var(--green)" }}>
                      <PlayerName name={m.winnerName} />
                    </Link>
                  </td>
                  <td>
                    <Link className="player-link" to={`/player/${encodeURIComponent(m.loserName)}`} style={{ color: "var(--red)" }}>
                      <PlayerName name={m.loserName} />
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
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <Delta value={winnerDelta} />
                    <span style={{ color: "var(--text-dim)" }}> / </span>
                    <Delta value={loserDelta} />
                  </td>
                  <td className="num rating">{round0(winnerAfter)}</td>
                  <td className="num rating">{round0(loserAfter)}</td>
                  {role === "admin" && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn ghost"
                        style={{ marginRight: 8 }}
                        disabled={busy === m.id}
                        onClick={() => setMoving(m)}
                      >
                        Move
                      </button>
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

      {moving && (
        <MoveMatchModal
          match={moving}
          all={replayResult.enriched}
          onClose={() => setMoving(null)}
          onMove={moveMatch}
        />
      )}
    </div>
  );
}

/**
 * Re-slot a match in the log. Defaults to the position its date implies —
 * right after the last match played on or before that day — which is
 * exactly where a backfilled match usually belongs.
 */
function MoveMatchModal({
  match,
  all,
  onClose,
  onMove,
}: {
  match: EnrichedMatch;
  all: EnrichedMatch[]; // chronological (seq order)
  onClose: () => void;
  onMove: (id: string, afterId: string | null) => Promise<void>;
}) {
  const others = useMemo(() => all.filter((m) => m.id !== match.id), [all, match]);
  const currentAfter = useMemo(() => {
    const idx = all.findIndex((m) => m.id === match.id);
    return idx > 0 ? all[idx - 1].id : "";
  }, [all, match]);
  const [afterId, setAfterId] = useState<string>(() => {
    const candidates = others.filter((m) => m.date <= match.date);
    return candidates.length > 0 ? candidates[candidates.length - 1].id : "";
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onMove(match.id, afterId || null);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Move match</h2>
        <p className="sub">
          #{match.seq} · {formatDate(match.date)} — <strong>{match.winnerName}</strong> def.{" "}
          <strong>{match.loserName}</strong>
        </p>
        <p className="sub">
          Ratings replay the log in this order, so slotting a match where it was
          actually played recalculates everything after it. The suggested spot
          matches this match's date.
        </p>
        <label className="field">Place directly after</label>
        <select value={afterId} onChange={(e) => setAfterId(e.target.value)}>
          <option value="">— start of the log —</option>
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              #{m.seq} · {formatDate(m.date)} — {m.winnerName} def. {m.loserName}
              {m.id === currentAfter ? " (current spot)" : ""}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={save}
            disabled={saving || afterId === currentAfter}
          >
            {saving ? "Moving…" : "Move match"}
          </button>
        </div>
      </div>
    </div>
  );
}
