import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMatches } from "../store/matches";
import { headToHead, predictMatch } from "../lib/elo";
import { formatDate, round0, pct, signed } from "../lib/format";
import H2HChart from "../components/H2HChart";

export default function HeadToHeadPage() {
  const { playerNames, replayResult } = useMatches();
  const [params, setParams] = useSearchParams();

  const [a, setA] = useState(params.get("a") ?? "");
  const [b, setB] = useState(params.get("b") ?? "");

  const pick = (side: "a" | "b", v: string) => {
    if (side === "a") setA(v);
    else setB(v);
    const next = new URLSearchParams(params);
    next.set(side, v);
    setParams(next, { replace: true });
  };

  const h2h = useMemo(() => {
    if (!a || !b || a === b) return null;
    return headToHead(replayResult.enriched, a, b);
  }, [a, b, replayResult]);

  const pred = useMemo(() => {
    if (!a || !b || a === b) return null;
    if (!replayResult.stats.has(a) || !replayResult.stats.has(b)) return null;
    return predictMatch(replayResult.enriched, replayResult.stats, a, b);
  }, [a, b, replayResult]);

  const streakLabel = (s: number) =>
    s === 0 ? "—" : s > 0 ? `W${s}` : `L${-s}`;

  const predictionBlock = pred && (
    <div style={{ marginTop: 18 }}>
      <label className="field">Win prediction — if they played today</label>
      <div className="pred-bar">
        <div className="seg-a" style={{ width: `${pred.pA * 100}%` }} />
        <div className="seg-b" style={{ width: `${(1 - pred.pA) * 100}%` }} />
      </div>
      <div className="pred-legend">
        <span className="win-a">
          {a} {pct(pred.pA)}
        </span>
        <span className="win-b">
          {pct(1 - pred.pA)} {b}
        </span>
      </div>
      <div className="pred-verdict">
        Predicted result:{" "}
        <strong className={pred.pA >= 0.5 ? "win-a" : "win-b"}>
          {pred.pA >= 0.5 ? a : b} wins{" "}
          {Math.max(pred.sets.a, pred.sets.b)}–{Math.min(pred.sets.a, pred.sets.b)}
        </strong>{" "}
        (best of 5)
      </div>
      <div className="pred-detail">
        rating edge: {pred.pRating >= 0.5 ? a : b}{" "}
        {pct(Math.max(pred.pRating, 1 - pred.pRating))} · head-to-head:{" "}
        {pred.h2hWinsA + pred.h2hWinsB === 0
          ? "never met"
          : `${pred.h2hWinsA >= pred.h2hWinsB ? a : b} leads ${Math.max(pred.h2hWinsA, pred.h2hWinsB)}–${Math.min(pred.h2hWinsA, pred.h2hWinsB)}`}{" "}
        · form: {a} {streakLabel(pred.streakA)}, {b} {streakLabel(pred.streakB)}
      </div>
    </div>
  );

  return (
    <>
      <div className="card">
        <h2>Head-to-Head</h2>
        <p className="sub">Pick two players to see their full history against each other.</p>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div>
            <label className="field">Player 1</label>
            <select value={a} onChange={(e) => pick("a", e.target.value)}>
              <option value="">Select player…</option>
              {playerNames.map((n) => (
                <option key={n} value={n} disabled={n === b}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field">Player 2</label>
            <select value={b} onChange={(e) => pick("b", e.target.value)}>
              <option value="">Select player…</option>
              {playerNames.map((n) => (
                <option key={n} value={n} disabled={n === a}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {h2h && h2h.total === 0 && (
        <div className="card">
          <p className="sub" style={{ margin: 0 }}>
            {a} and {b} haven't played each other yet.
          </p>
          {predictionBlock}
        </div>
      )}

      {h2h && h2h.total > 0 && (
        <>
          <div className="card">
            <div className="h2h-hero">
              <div className="h2h-side">
                <div className="name win-a">{h2h.a}</div>
                <div className="big win-a">{h2h.winsA}</div>
                <div className="meta">{pct(h2h.winsA / h2h.total)} of meetings</div>
              </div>
              <div className="h2h-vs">VS</div>
              <div className="h2h-side">
                <div className="name win-b">{h2h.b}</div>
                <div className="big win-b">{h2h.winsB}</div>
                <div className="meta">{pct(h2h.winsB / h2h.total)} of meetings</div>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-tile">
                <div className="label">Current streak</div>
                <div className="value">
                  {h2h.streakHolder ? `${h2h.streakLength}` : "—"}
                </div>
                <div className="hint">
                  {h2h.streakHolder
                    ? `${h2h.streakHolder} has won the last ${h2h.streakLength}`
                    : "no matches yet"}
                </div>
              </div>
              <div className="stat-tile">
                <div className="label">Best streak — {h2h.a}</div>
                <div className="value">{h2h.bestStreakA}</div>
                <div className="hint">consecutive wins</div>
              </div>
              <div className="stat-tile">
                <div className="label">Best streak — {h2h.b}</div>
                <div className="value">{h2h.bestStreakB}</div>
                <div className="hint">consecutive wins</div>
              </div>
              <div className="stat-tile">
                <div className="label">Rating swing</div>
                <div className="value">{signed(h2h.ratingSwingA)}</div>
                <div className="hint">net ELO {h2h.a} gained from this matchup</div>
              </div>
              <div className="stat-tile">
                <div className="label">First meeting</div>
                <div className="value" style={{ fontSize: 15 }}>
                  {formatDate(h2h.firstMeeting)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="label">Last meeting</div>
                <div className="value" style={{ fontSize: 15 }}>
                  {formatDate(h2h.lastMeeting)}
                </div>
              </div>
            </div>

            {predictionBlock}

            <div style={{ marginTop: 18 }}>
              <label className="field">Results timeline (newest → oldest)</label>
              <div className="pill-row">
                {[...h2h.matches].reverse().map((m) => (
                  <span
                    key={m.id}
                    className={`pill ${m.winnerName === h2h.a ? "a" : "b"}`}
                    title={`${formatDate(m.date)} — ${m.winnerName} beat ${m.loserName}${m.score ? ` (${m.score})` : ""}`}
                  >
                    {m.winnerName[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Rivalry graph</h2>
            <p className="sub">
              The running lead across all {h2h.total} meetings — when the line is above
              zero <span className="win-a">{h2h.a}</span> is in front, below it{" "}
              <span className="win-b">{h2h.b}</span> is. Hover a dot for that match.
            </p>
            <H2HChart matches={h2h.matches} a={h2h.a} b={h2h.b} />
          </div>

          <div className="card">
            <h2>All matches</h2>
            <p className="sub">
              {h2h.total} matches between{" "}
              <Link className="player-link" to={`/player/${encodeURIComponent(h2h.a)}`}>
                {h2h.a}
              </Link>{" "}
              and{" "}
              <Link className="player-link" to={`/player/${encodeURIComponent(h2h.b)}`}>
                {h2h.b}
              </Link>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Winner</th>
                    <th>Score</th>
                    <th className="num">ELO exchange</th>
                    <th className="num">{h2h.a} rating</th>
                    <th className="num">{h2h.b} rating</th>
                  </tr>
                </thead>
                <tbody>
                  {[...h2h.matches].reverse().map((m) => {
                    const aIsP1 = m.player1 === h2h.a;
                    const aAfter = aIsP1 ? m.rating1After : m.rating2After;
                    const bAfter = aIsP1 ? m.rating2After : m.rating1After;
                    return (
                      <tr key={m.id}>
                        <td>{formatDate(m.date)}</td>
                        <td>
                          <span className={m.winnerName === h2h.a ? "win-a" : "win-b"} style={{ fontWeight: 700 }}>
                            {m.winnerName}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>{m.score ?? "—"}</td>
                        <td className="num delta-up">{signed(Math.abs(m.delta))}</td>
                        <td className="num rating">{round0(aAfter)}</td>
                        <td className="num rating">{round0(bAfter)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
