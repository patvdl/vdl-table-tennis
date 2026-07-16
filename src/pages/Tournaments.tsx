import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMatches, type TournamentSummary } from "../store/matches";
import { useAuth } from "../store/auth";
import { formatDate } from "../lib/format";
import Bracket, { PlannedBracket } from "../components/Bracket";
import Avatar from "../components/Avatar";
import PlayerName from "../components/PlayerName";

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
            <Avatar player={s.name!} size={60} />
            <div>
              <div className="label">{s.label}</div>
              <Link
                className="player-link podium-name"
                to={`/player/${encodeURIComponent(s.name!)}`}
              >
                <PlayerName name={s.name!} />
              </Link>
            </div>
          </div>
        ))}
    </div>
  );
}

const NEW = "__new__";
const SIZES = [4, 8, 16, 32];

function BracketEditor({
  t,
  playerNames,
  busy,
  onSave,
  onRemove,
}: {
  t: TournamentSummary;
  playerNames: string[];
  busy: boolean;
  onSave: (slots: (string | null)[]) => void;
  onRemove: (() => void) | null;
}) {
  const initial = t.bracket;
  const [size, setSize] = useState(initial?.length ?? 16);
  const [slots, setSlots] = useState<string[]>(() => {
    const arr: string[] = Array(initial?.length ?? 16).fill("");
    initial?.forEach((s, i) => {
      if (s) arr[i] = s;
    });
    return arr;
  });
  const [customNames, setCustomNames] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const resize = (n: number) => {
    setSize(n);
    setSlots((prev) => {
      const arr: string[] = Array(n).fill("");
      prev.slice(0, n).forEach((s, i) => (arr[i] = s));
      return arr;
    });
  };

  const resolved = slots.map((s, i) =>
    s === NEW ? (customNames[i] ?? "").trim() : s,
  );
  const filled = resolved.filter(Boolean);
  const duplicates = [...new Set(filled.filter((n, i) => filled.indexOf(n) !== i))];

  const setSlot = (i: number, v: string) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? v : s)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (filled.length < 2) {
      setErr("Place at least two players in the bracket.");
      return;
    }
    if (duplicates.length > 0) {
      setErr(`Each player can only appear once: ${duplicates.join(", ")}`);
      return;
    }
    onSave(resolved.map((s) => s || null));
  };

  const pairs = [];
  for (let i = 0; i < size; i += 2) pairs.push(i);

  return (
    <form onSubmit={submit} className="draw-editor">
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label className="field">Bracket size</label>
          <select value={size} onChange={(e) => resize(Number(e.target.value))}>
            {SIZES.map((n) => (
              <option key={n} value={n}>
                {n} slots ({n / 2} first-round matches)
              </option>
            ))}
          </select>
        </div>
        <p className="sub" style={{ fontSize: 12, margin: 0, flex: 1, minWidth: 220 }}>
          Fill the first-round pairings top to bottom, exactly like the paper bracket. Leave a
          slot as <i>bye</i> to give the other player a free pass. Winners of match 1 &amp; 2
          meet next round, and so on.
        </p>
      </div>

      <div className="draw-grid">
        {pairs.map((i) => (
          <div className="draw-pair" key={i}>
            <div className="draw-pair-tag">Match {i / 2 + 1}</div>
            {[i, i + 1].map((j) => (
              <div key={j} style={{ marginTop: j === i ? 0 : 6 }}>
                <select value={slots[j]} onChange={(e) => setSlot(j, e.target.value)}>
                  <option value="">— bye —</option>
                  {playerNames.map((n) => (
                    <option
                      key={n}
                      value={n}
                      disabled={resolved.some((r, k) => k !== j && r === n)}
                    >
                      {n}
                    </option>
                  ))}
                  <option value={NEW}>+ New player…</option>
                </select>
                {slots[j] === NEW && (
                  <input
                    style={{ marginTop: 6 }}
                    placeholder="New player name"
                    value={customNames[j] ?? ""}
                    onChange={(e) =>
                      setCustomNames((prev) => ({ ...prev, [j]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {err && <div className="notice err">{err}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save bracket"}
        </button>
        <span className="sub" style={{ alignSelf: "center", fontSize: 12 }}>
          {filled.length} players placed
        </span>
        {onRemove && (
          <button
            className="btn danger"
            type="button"
            disabled={busy}
            style={{ marginLeft: "auto" }}
            onClick={onRemove}
          >
            Remove bracket
          </button>
        )}
      </div>
    </form>
  );
}

export default function Tournaments() {
  const {
    tournaments,
    playerNames,
    addTournament,
    setTournamentStatus,
    setTournamentBracket,
    removeTournament,
  } = useMatches();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState(`Christmas ${new Date().getFullYear()}`);
  const [newDate, setNewDate] = useState(today());
  const [editingBracket, setEditingBracket] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const autoEditRef = useRef(false);

  // Default to the active tournament (the one being played), otherwise the newest
  const selected = useMemo(() => {
    const byId = tournaments.find((t) => t.id === selectedId);
    if (byId) return byId;
    return tournaments.find((t) => t.status === "active") ?? tournaments[0] ?? null;
  }, [tournaments, selectedId]);

  // Close (or auto-open, right after creating) the editor when switching tournaments
  useEffect(() => {
    if (autoEditRef.current) {
      autoEditRef.current = false;
      setEditingBracket(true);
    } else {
      setEditingBracket(false);
    }
  }, [selected?.id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setMsg({ kind: "err", text: "Give the tournament a name." });
      return;
    }
    await run(async () => {
      autoEditRef.current = true;
      await addTournament(name, newDate);
      setMsg({
        kind: "ok",
        text: `Created "${name}" — now fill out the bracket below, then record results from Add Match.`,
      });
      setShowAdd(false);
      setSelectedId(null); // jump to the new active tournament
    });
  };

  const toggleStatus = async (t: TournamentSummary) => {
    const completing = t.status === "active";
    const q = completing
      ? `Mark "${t.name}" as completed? It will no longer appear in the Add Match dropdown.`
      : `Reopen "${t.name}"? It will appear in the Add Match dropdown again.`;
    if (!confirm(q)) return;
    await run(() => setTournamentStatus(t.id, completing ? "completed" : "active"));
  };

  const deleteTournament = async (t: TournamentSummary) => {
    const n = t.analysis.matches.length;
    const q =
      n === 0
        ? `Delete "${t.name}"? (It has no matches, so nothing else is affected.)`
        : `Delete "${t.name}"? Its ${n} ${n === 1 ? "match stays" : "matches stay"} in the match history and still count for ELO, but the bracket, champion record and trophy are removed. Re-creating a tournament with the exact same name brings them back.`;
    if (!confirm(q)) return;
    await run(async () => {
      await removeTournament(t.id);
      setSelectedId(null);
    });
  };

  const saveBracket = async (t: TournamentSummary, slots: (string | null)[]) => {
    await run(async () => {
      await setTournamentBracket(t.id, slots);
      setEditingBracket(false);
      setMsg({ kind: "ok", text: "Bracket saved — it will fill in as results are recorded." });
    });
  };

  const removeBracket = async (t: TournamentSummary) => {
    if (!confirm(`Remove the bracket from "${t.name}"? Recorded matches are kept.`)) return;
    await run(async () => {
      await setTournamentBracket(t.id, null);
      setEditingBracket(false);
    });
  };

  const a = selected?.analysis;
  const isCompleted = selected?.status === "completed";
  const showRound = Boolean(isCompleted || a?.planned);

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
              New tournaments start as <b>active</b>: set up the bracket, record results from Add
              Match as they happen, then mark it completed here when it's done.
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
                {selected.status === "active" && (
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => setEditingBracket((v) => !v)}
                  >
                    {editingBracket
                      ? "Close editor"
                      : selected.bracket
                        ? "Edit bracket"
                        : "Set up bracket"}
                  </button>
                )}
                <button className="btn ghost" disabled={busy} onClick={() => toggleStatus(selected)}>
                  {selected.status === "active" ? "Mark as completed" : "Reopen tournament"}
                </button>
                <button className="btn danger" disabled={busy} onClick={() => deleteTournament(selected)}>
                  Delete
                </button>
              </div>
            )}
          </div>

          {editingBracket && isAdmin && selected.status === "active" && (
            <BracketEditor
              key={selected.id}
              t={selected}
              playerNames={playerNames}
              busy={busy}
              onSave={(slots) => void saveBracket(selected, slots)}
              onRemove={selected.bracket ? () => void removeBracket(selected) : null}
            />
          )}

          {isCompleted && <Podium t={selected} />}

          {a.planned ? (
            <PlannedBracket
              root={a.planned}
              maxDepth={a.maxDepth}
              thirdPlaceMatch={a.thirdPlaceMatch}
              thirdPlacePending={a.thirdPlacePending}
            />
          ) : a.matches.length === 0 ? (
            <p className="sub" style={{ marginTop: 12 }}>
              No matches recorded yet.
              {selected.status === "active" &&
                " Set up the bracket here, then record results from the Add Match page with this tournament selected."}
            </p>
          ) : isCompleted && a.bracket ? (
            <Bracket root={a.bracket} maxDepth={a.maxDepth} thirdPlaceMatch={a.thirdPlaceMatch} />
          ) : (
            <div className="notice ok" style={{ marginTop: 12 }}>
              Tournament in progress — set up a bracket to see it fill in live, or the bracket is
              drawn automatically once the tournament is marked completed.
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
                  {showRound && <th>Round</th>}
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
                    {showRound && <td>{a.roundOf.get(m.id) ?? "—"}</td>}
                    <td>
                      <Link
                        className="player-link"
                        to={`/player/${encodeURIComponent(m.winnerName)}`}
                        style={{ color: "var(--green)" }}
                      >
                        <PlayerName name={m.winnerName} />
                      </Link>
                    </td>
                    <td>
                      <Link
                        className="player-link"
                        to={`/player/${encodeURIComponent(m.loserName)}`}
                        style={{ color: "var(--red)" }}
                      >
                        <PlayerName name={m.loserName} />
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
