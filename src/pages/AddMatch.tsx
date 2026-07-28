import { useMemo, useState, type FormEvent } from "react";
import { useMatches } from "../store/matches";
import { useAuth } from "../store/auth";
import { predictMatch } from "../lib/elo";
import { pct, round0 } from "../lib/format";
import { pendingContests } from "../lib/simulate";
import PlayerCombo from "../components/PlayerCombo";

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AddMatch() {
  const { replayResult, addMatch, tournaments } = useMatches();
  const { role } = useAuth();
  const activeTournaments = tournaments.filter((t) => t.status === "active");

  const [date, setDate] = useState(today());
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [winner, setWinner] = useState<1 | 2>(1);
  const [score, setScore] = useState("");
  const [isTournament, setIsTournament] = useState(false);
  const [tournament, setTournament] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const name1 = p1.trim();
  const name2 = p2.trim();

  // The tournament being recorded into, and what its bracket allows
  const selectedT = isTournament
    ? activeTournaments.find((t) => t.name === tournament)
    : undefined;
  const drawPlayers = useMemo(() => {
    if (!selectedT?.bracket) return null; // no stored draw — anyone can play
    return [...new Set(selectedT.bracket.filter((s): s is string => Boolean(s)))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [selectedT]);
  // The bracket's playable matchups right now: pending contests where both
  // players are known, plus the 3rd-place playoff once the semis are done.
  const upcoming = useMemo(() => {
    if (!selectedT?.bracket) return null;
    const a = selectedT.analysis;
    const pairs = pendingContests(a.planned).map((c) => [c.a, c.b] as [string, string]);
    if (a.thirdPlacePending) pairs.push(a.thirdPlacePending);
    return pairs;
  }, [selectedT]);

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
    if (isTournament) {
      if (!tournament.trim()) {
        setMsg({ kind: "err", text: "Pick a tournament, or untick the Tournament box." });
        return;
      }
      if (drawPlayers) {
        const outsiders = [name1, name2].filter((n) => !drawPlayers.includes(n));
        if (outsiders.length > 0) {
          setMsg({
            kind: "err",
            text: `Can't add: ${outsiders.join(" and ")} ${outsiders.length === 1 ? "isn't" : "aren't"} in the ${tournament} bracket.`,
          });
          return;
        }
        const isUpcoming = upcoming?.some(
          ([a, b]) =>
            (a === name1 && b === name2) || (a === name2 && b === name1),
        );
        if (!isUpcoming) {
          const next = upcoming?.map(([a, b]) => `${a} vs ${b}`).join(", ");
          setMsg({
            kind: "err",
            text: `Can't add: ${name1} vs ${name2} isn't one of ${tournament}'s playable bracket matches right now${next ? ` (next up: ${next})` : ""}.`,
          });
          return;
        }
      }
    }
    setSaving(true);
    try {
      await addMatch({
        date,
        player1: name1,
        player2: name2,
        winner,
        score: score.trim() || null,
        tournament: isTournament ? tournament.trim() || null : null,
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
            <label
              className="field"
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={isTournament}
                onChange={(e) => {
                  setIsTournament(e.target.checked);
                  setTournament(e.target.checked ? (activeTournaments[0]?.name ?? "") : "");
                }}
              />
              Tournament
            </label>
            {isTournament &&
              (activeTournaments.length > 0 ? (
                <>
                  <select
                    style={{ marginTop: 8 }}
                    value={tournament}
                    onChange={(e) => setTournament(e.target.value)}
                  >
                    {activeTournaments.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {upcoming && (
                    <p className="sub" style={{ marginTop: 8, fontSize: 12 }}>
                      {upcoming.length > 0
                        ? `Playable bracket matches: ${upcoming.map(([a, b]) => `${a} vs ${b}`).join(" · ")}`
                        : "The bracket has no playable matches right now — earlier rounds must be recorded first."}
                    </p>
                  )}
                </>
              ) : (
                <p className="sub" style={{ marginTop: 8, fontSize: 12 }}>
                  No active tournament. Create one from the Tournaments tab first.
                </p>
              ))}
          </div>
          <div />
        </div>

        <div className="form-row">
          <div>
            <label className="field">Player 1</label>
            <PlayerCombo value={p1} onChange={setP1} only={drawPlayers ?? undefined} />
          </div>
          <div>
            <label className="field">Player 2</label>
            <PlayerCombo value={p2} onChange={setP2} only={drawPlayers ?? undefined} />
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
