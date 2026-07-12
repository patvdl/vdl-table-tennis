import { useMemo, useState, type FormEvent } from "react";
import { useMatches } from "../store/matches";
import { useAuth } from "../store/auth";
import { predictMatch } from "../lib/elo";
import { pct, round0 } from "../lib/format";

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AddMatch() {
  const { playerNames, replayResult, addMatch } = useMatches();
  const { role } = useAuth();

  const [date, setDate] = useState(today());
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [newP1, setNewP1] = useState("");
  const [newP2, setNewP2] = useState("");
  const [winner, setWinner] = useState<1 | 2>(1);
  const [score, setScore] = useState("");
  const [tournament, setTournament] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const name1 = p1 === "__new__" ? newP1.trim() : p1;
  const name2 = p2 === "__new__" ? newP2.trim() : p2;

  const preview = useMemo(() => {
    if (!name1 || !name2 || name1 === name2) return null;
    const r1 = replayResult.stats.get(name1)?.rating ?? 1000;
    const r2 = replayResult.stats.get(name2)?.rating ?? 1000;
    const p = predictMatch(replayResult.enriched, replayResult.stats, name1, name2);
    return { r1, r2, p };
  }, [name1, name2, replayResult]);

  if (role !== "admin") {
    return (
      <div className="card">
        <h2>Add Match</h2>
        <p className="sub">Only admins can record matches. Sign in with an admin account.</p>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!name1 || !name2) {
      setMsg({ kind: "err", text: "Pick both players." });
      return;
    }
    if (name1 === name2) {
      setMsg({ kind: "err", text: "Players must be different." });
      return;
    }
    setSaving(true);
    try {
      await addMatch({
        date,
        player1: name1,
        player2: name2,
        winner,
        score: score.trim() || null,
        tournament: tournament.trim() || null,
      });
      setMsg({
        kind: "ok",
        text: `Recorded: ${winner === 1 ? name1 : name2} beat ${winner === 1 ? name2 : name1}${score ? ` (${score.trim()})` : ""}.`,
      });
      setScore("");
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const playerSelect = (
    value: string,
    onChange: (v: string) => void,
    exclude: string,
  ) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select player…</option>
      {playerNames.map((n) => (
        <option key={n} value={n} disabled={n === exclude}>
          {n}
        </option>
      ))}
      <option value="__new__">+ New player…</option>
    </select>
  );

  return (
    <div className="card">
      <h2>Add Match</h2>
      <p className="sub">
        The score is stored for the record only — it never affects ELO. Only the winner does.
      </p>

      {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}

      <form onSubmit={submit}>
        <div className="form-row">
          <div>
            <label className="field">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="field">Score (optional, e.g. 21-15 or 3-2 sets)</label>
            <input
              type="text"
              placeholder="21-15"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div>
            <label className="field">Tournament (optional, record only)</label>
            <input
              type="text"
              placeholder="e.g. Christmas 2026"
              value={tournament}
              onChange={(e) => setTournament(e.target.value)}
            />
          </div>
          <div />
        </div>

        <div className="form-row">
          <div>
            <label className="field">Player 1</label>
            {playerSelect(p1, setP1, p2)}
            {p1 === "__new__" && (
              <input
                style={{ marginTop: 8 }}
                placeholder="New player name"
                value={newP1}
                onChange={(e) => setNewP1(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="field">Player 2</label>
            {playerSelect(p2, setP2, p1)}
            {p2 === "__new__" && (
              <input
                style={{ marginTop: 8 }}
                placeholder="New player name"
                value={newP2}
                onChange={(e) => setNewP2(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="form-row">
          <div>
            <label className="field">Winner</label>
            <select
              value={winner}
              onChange={(e) => setWinner(Number(e.target.value) === 1 ? 1 : 2)}
            >
              <option value={1}>{name1 || "Player 1"}</option>
              <option value={2}>{name2 || "Player 2"}</option>
            </select>
          </div>
          {preview && (
            <div>
              <label className="field">Pre-match prediction</label>
              <div className="stat-tile" style={{ padding: "9px 14px" }}>
                <div style={{ fontSize: 13 }}>
                  {name1} ({round0(preview.r1)}) — {pct(preview.p.pA)} to win
                  <br />
                  {name2} ({round0(preview.r2)}) — {pct(1 - preview.p.pA)} to win
                  <br />
                  <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    predicted: {preview.p.pA >= 0.5 ? name1 : name2} in{" "}
                    {Math.max(preview.p.sets.a, preview.p.sets.b)}–
                    {Math.min(preview.p.sets.a, preview.p.sets.b)} sets
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Record match"}
        </button>
      </form>
    </div>
  );
}
