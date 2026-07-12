import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMatches, type TournamentSummary } from "../store/matches";
import { useAuth } from "../store/auth";
import { formatDate } from "../lib/format";
import Bracket from "../components/Bracket";

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function Podium({ t }: { t: TournamentSummary }) {
  const { analysis } = t;
  if (!analysis.champion) return null;
  const spots: Array<{ medal: string; label: string; name: string | null }> = [
    { medal: "🥇", label: "Champion", name: analysis.champion },
    { medal: "🥈", label: "Runner-up", name: analysis.runnerUp },
    { medal: "🥉", label: "3rd place", name: analysis.thirdPlace },
  ];
  return (
    <div className="podium">
      {spots
        .filter((s) => s.name)
        .map((s) => (
          <div key={s.label} className={`podium-tile ${s.label === "Champion" ? "champ" : ""}`}>
            <div className="podium-medal">{s.medal}</div>
            <div>
              <div className="label">{s.label}</div>
              <Link
                className="player-link podium-name"
                to={`/player/${encodeURIComponent(s.name!)}`}
              >
                {s.name}
              </Link>
            </div>
          </div>
        ))}
    </div>
  );
}

export default function Tournaments() {
  const { tournaments, addTournament, setTournamentStatus, removeTournament } = useMatches();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState(`Christmas ${new Date().getFullYear()}`);
  const [newDate, setNewDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Default to the active tournament (the one being played), otherwise the newest
  const selected = useMemo(() => {
    const byId = tournaments.find((t) => t.id === selectedId);
    if (byId) return byId;
    return tournaments.find((t) => t.status === "active") ?? tournaments[0] ?? null;
  }, [tournaments, selectedId]);

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const name = newName.trim();
    if (!name) {
      setMsg({ kind: "err", text: "Give the tournament a name." });
      return;
    }
    setBusy(true);
    try {
      await addTournament(name, newDate);
      setMsg({ kind: "ok", text: `Created "${name}" — it's now active and selectable when adding matches.` });
      setShowAdd(false);
      setSelectedId(null); // jump to the new active tournament
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (t: TournamentSummary) => {
    const completing = t.status === "active";
    const q = completing
      ? `Mark "${t.name}" as completed? It will no longer appear in the Add Match dropdown.`
      : `Reopen "${t.name}"? It will appear in the Add Match dropdown again.`;
    if (!confirm(q)) return;
    setBusy(true);
    setMsg(null);
    try {
      await setTournamentStatus(t.id, completing ? "completed" : "active");
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const deleteEmpty = async (t: TournamentSummary) => {
    if (!confirm(`Delete "${t.name}"? (It has no matches, so nothing else is affected.)`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await removeTournament(t.id);
      setSelectedId(null);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const a = selected?.analysis;
  const isCompleted = selected?.status === "completed";

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2>Tournaments</h2>
            <p className="sub">Brackets, results and champions of every VDL tournament.</p>
          </div>
          {isAdmin && (
            <button className="btn ghost" onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? "Cancel" : "+ New tournament"}
            </button>
          )}
        </div>

        {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}

        {showAdd && isAdmin && (
          <form onSubmit={submitNew} style={{ marginBottom: 16 }}>
            <div className="form-row">
              <div>
                <label className="field">Tournament name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Christmas 2026" />
              </div>
              <div>
                <label className="field">Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            </div>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create tournament"}
            </button>
            <p className="sub" style={{ marginTop: 8, fontSize: 12 }}>
              New tournaments start as <b>active</b>: they show up in the Add Match dropdown so you
              can record results live, then mark it completed here when it's done.
            </p>
          </form>
        )}

        {tournaments.length === 0 ? (
          <p className="sub">No tournaments yet.</p>
        ) : (
          <div style={{ maxWidth: 320 }}>
            <label className="field">Select tournament</label>
            <select value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status === "active" ? " (in progress)" : t.champion ? ` — 🏆 ${t.champion}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selected && a && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2>
                {selected.name}{" "}
                <span className={`badge ${isCompleted ? "neutral" : "gold"}`}>
                  {isCompleted ? "completed" : "in progress"}
                </span>
              </h2>
              <p className="sub">
                {formatDate(selected.date)} · {a.players.length} players · {a.matches.length}{" "}
                {a.matches.length === 1 ? "match" : "matches"}
              </p>
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn ghost" disabled={busy} onClick={() => toggleStatus(selected)}>
                  {selected.status === "active" ? "Mark as completed" : "Reopen tournament"}
                </button>
                {a.matches.length === 0 && (
                  <button className="btn danger" disabled={busy} onClick={() => deleteEmpty(selected)}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {isCompleted && <Podium t={selected} />}

          {a.matches.length === 0 ? (
            <p className="sub" style={{ marginTop: 12 }}>
              No matches recorded yet.
              {selected.status === "active" &&
                " Record them from the Add Match page with this tournament selected."}
            </p>
          ) : isCompleted && a.bracket ? (
            <Bracket root={a.bracket} maxDepth={a.maxDepth} thirdPlaceMatch={a.thirdPlaceMatch} />
          ) : (
            <div className="notice ok" style={{ marginTop: 12 }}>
              Tournament in progress — the full bracket is drawn once it's marked completed.
            </div>
          )}
        </div>
      )}

      {selected && a && a.matches.length > 0 && (
        <div className="card">
          <h2>Matches</h2>
          <p className="sub">All matches of {selected.name}, in the order they were played.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  {isCompleted && <th>Round</th>}
                  <th>Winner</th>
                  <th>Loser</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {a.matches.map((m, i) => (
                  <tr key={m.id}>
                    <td className="num" style={{ color: "var(--text-dim)" }}>
                      {i + 1}
                    </td>
                    {isCompleted && <td>{a.roundOf.get(m.id) ?? "—"}</td>}
                    <td>
                      <Link
                        className="player-link"
                        to={`/player/${encodeURIComponent(m.winnerName)}`}
                        style={{ color: "var(--green)" }}
                      >
                        {m.winnerName}
                      </Link>
                    </td>
                    <td>
                      <Link
                        className="player-link"
                        to={`/player/${encodeURIComponent(m.loserName)}`}
                        style={{ color: "var(--red)" }}
                      >
                        {m.loserName}
                      </Link>
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{m.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
