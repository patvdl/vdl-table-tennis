import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMatches } from "../store/matches";
import { headToHead, predictMatch } from "../lib/elo";
import { formatDate, round0, pct, signed } from "../lib/format";
import H2HChart from "../components/H2HChart";
import Avatar from "../components/Avatar";
import PlayerName from "../components/PlayerName";
import StreakBadge from "../components/StreakBadge";

export default function HeadToHeadPage() {
  const { playerNames, replayResult, board } = useMatches();
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

  /** Date of each player's first recorded match */
  const firstPlayed = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of replayResult.enriched) {
      if (!map.has(m.player1)) map.set(m.player1, m.date);
      if (!map.has(m.player2)) map.set(m.player2, m.date);
    }
    return map;
  }, [replayResult]);

  /** Total sets won by each player, counting only meetings with a recorded score */
  const setsWon = useMemo(() => {
    if (!h2h) return null;
    let sa = 0;
    let sb = 0;
    let any = false;
    for (const m of h2h.matches) {
      const mm = /^(\d+)\s*[-–]\s*(\d+)$/.exec(m.score?.trim() ?? "");
      if (!mm) continue;
      any = true;
      const w = Number(mm[1]);
      const l = Number(mm[2]);
      if (m.winnerName === h2h.a) {
        sa += w;
        sb += l;
      } else {
        sb += w;
        sa += l;
      }
    }
    return any ? { a: sa, b: sb } : null;
  }, [h2h]);

  /** Split bar: green share grows with A's lead, blue with B's */
  const duelBar = (va: number, vb: number) => {
    const shareA = va + vb > 0 ? va / (va + vb) : 0.5;
    return (
      <div className="duel-bar">
        <div className="seg-a" style={{ width: `${shareA * 100}%` }} />
        <div className="seg-b" style={{ width: `${(1 - shareA) * 100}%` }} />
      </div>
    );
  };

  /** ATP-style career box shown on each player's side of the comparison */
  const sideCard = (name: string, cls: "win-a" | "win-b") => {
    const s = replayResult.stats.get(name);
    const rank = board.findIndex((p) => p.name === name) + 1;
    const since = firstPlayed.get(name);
    return (
      <div className="side-card">
        <div className={`side-title ${cls}`}>
          <Link className="player-link" to={`/player/${encodeURIComponent(name)}`}>
            <PlayerName name={name} />
          </Link>
        </div>
        <div className="sc-row">
          <span className="k">Rank</span>
          <span className="v mono">{rank > 0 ? `#${rank}` : "Unrated"}</span>
        </div>
        <div className="sc-row">
          <span className="k">Career-high rank</span>
          <span className="v mono">
            {s && s.bestRankDate ? `#${s.bestRank}` : "—"}
          </span>
        </div>
        <div className="sc-row">
          <span className="k">Rating</span>
          <span className="v mono">{s && rank > 0 ? round0(s.rating) : "—"}</span>
        </div>
        <div className="sc-row">
          <span className="k">Peak rating</span>
          <span className="v mono">{s && rank > 0 ? round0(s.peakRating) : "—"}</span>
        </div>
        <div className="sc-row">
          <span className="k">Career W–L</span>
          <span className="v mono">
            <span style={{ color: "var(--green)" }}>{s?.wins ?? 0}</span>–
            <span style={{ color: "var(--red)" }}>{s?.losses ?? 0}</span>
          </span>
        </div>
        <div className="sc-row">
          <span className="k">Win rate</span>
          <span className="v mono">
            {s && s.played > 0 ? pct(s.wins / s.played) : "—"}
          </span>
        </div>
        <div className="sc-row">
          <span className="k">Current streak</span>
          <span className="v">
            <StreakBadge streak={s?.streak ?? 0} />
          </span>
        </div>
        <div className="sc-row">
          <span className="k">Playing since</span>
          <span className="v">{since ? formatDate(since) : "—"}</span>
        </div>
      </div>
    );
  };

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
          : pred.h2hWinsA === pred.h2hWinsB
            ? `tied ${pred.h2hWinsA}–${pred.h2hWinsB}`
            : `${pred.h2hWinsA > pred.h2hWinsB ? a : b} leads ${Math.max(pred.h2hWinsA, pred.h2hWinsB)}–${Math.min(pred.h2hWinsA, pred.h2hWinsB)}`}{" "}
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
          <div className="h2h-hero" style={{ paddingBottom: 8 }}>
            <div className="h2h-side">
              <Avatar player={a} size={264} />
              <div className="name win-a" style={{ marginTop: 8 }}>
                <Link className="player-link" to={`/player/${encodeURIComponent(a)}`}>
                  <PlayerName name={a} />
                </Link>
              </div>
            </div>
            <div className="h2h-vs">VS</div>
            <div className="h2h-side">
              <Avatar player={b} size={264} />
              <div className="name win-b" style={{ marginTop: 8 }}>
                <Link className="player-link" to={`/player/${encodeURIComponent(b)}`}>
                  <PlayerName name={b} />
                </Link>
              </div>
            </div>
          </div>
          <p className="sub" style={{ margin: 0, textAlign: "center" }}>
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
                <Avatar player={h2h.a} size={264} />
                <div className="name win-a" style={{ marginTop: 8 }}>
                  <Link className="player-link" to={`/player/${encodeURIComponent(h2h.a)}`}>
                    <PlayerName name={h2h.a} />
                  </Link>
                </div>
                <div className="big win-a">{h2h.winsA}</div>
                <div className="meta">{pct(h2h.winsA / h2h.total)} of meetings</div>
              </div>
              <div className="h2h-vs">VS</div>
              <div className="h2h-side">
                <Avatar player={h2h.b} size={264} />
                <div className="name win-b" style={{ marginTop: 8 }}>
                  <Link className="player-link" to={`/player/${encodeURIComponent(h2h.b)}`}>
                    <PlayerName name={h2h.b} />
                  </Link>
                </div>
                <div className="big win-b">{h2h.winsB}</div>
                <div className="meta">{pct(h2h.winsB / h2h.total)} of meetings</div>
              </div>
            </div>

            <div className="h2h-compare">
              {sideCard(h2h.a, "win-a")}

              <div className="duel">
                <div className="duel-row">
                  <div className="duel-vals">
                    <span className="duel-a">{h2h.winsA}</span>
                    <span className="duel-label">
                      Wins
                      <small>this matchup</small>
                    </span>
                    <span className="duel-b">{h2h.winsB}</span>
                  </div>
                  {duelBar(h2h.winsA, h2h.winsB)}
                </div>
                {setsWon && (
                  <div className="duel-row">
                    <div className="duel-vals">
                      <span className="duel-a">{setsWon.a}</span>
                      <span className="duel-label">
                        Sets won
                        <small>scored matches</small>
                      </span>
                      <span className="duel-b">{setsWon.b}</span>
                    </div>
                    {duelBar(setsWon.a, setsWon.b)}
                  </div>
                )}
                <div className="duel-row">
                  <div className="duel-vals">
                    <span className="duel-a">W{h2h.bestStreakA}</span>
                    <span className="duel-label">
                      Best streak
                      <small>this matchup</small>
                    </span>
                    <span className="duel-b">W{h2h.bestStreakB}</span>
                  </div>
                  {duelBar(h2h.bestStreakA, h2h.bestStreakB)}
                </div>
                <div className="duel-row">
                  <div className="duel-vals">
                    <span
                      className={`duel-a ${h2h.ratingSwingA >= 0 ? "delta-up" : "delta-down"}`}
                    >
                      {signed(h2h.ratingSwingA)}
                    </span>
                    <span className="duel-label">
                      Net ELO
                      <small>this matchup</small>
                    </span>
                    <span
                      className={`duel-b ${h2h.ratingSwingB >= 0 ? "delta-up" : "delta-down"}`}
                    >
                      {signed(h2h.ratingSwingB)}
                    </span>
                  </div>
                  {duelBar(
                    Math.max(0, h2h.ratingSwingA),
                    Math.max(0, h2h.ratingSwingB),
                  )}
                </div>
                <div className="duel-meta">
                  first meeting {formatDate(h2h.firstMeeting)} · latest{" "}
                  {formatDate(h2h.lastMeeting)}
                </div>
              </div>

              {sideCard(h2h.b, "win-b")}
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
                <PlayerName name={h2h.a} />
              </Link>{" "}
              and{" "}
              <Link className="player-link" to={`/player/${encodeURIComponent(h2h.b)}`}>
                <PlayerName name={h2h.b} />
              </Link>
            </p>
            <div className="table-wrap pin-1">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Winner</th>
                    <th>Score</th>
                    <th className="num" title={`${h2h.a}–${h2h.b} after this match`}>
                      H2H
                    </th>
                    <th className="num">ELO exchange</th>
                    <th className="num">{h2h.a} rating</th>
                    <th className="num">{h2h.b} rating</th>
                  </tr>
                </thead>
                <tbody>
                  {[...h2h.matches].reverse().map((m, i) => {
                    const aIsP1 = m.player1 === h2h.a;
                    const aAfter = aIsP1 ? m.rating1After : m.rating2After;
                    const bAfter = aIsP1 ? m.rating2After : m.rating1After;
                    // Running record (a–b) once this match was played
                    const upTo = h2h.matches.length - i;
                    const aSoFar = h2h.matches
                      .slice(0, upTo)
                      .filter((x) => x.winnerName === h2h.a).length;
                    const bSoFar = upTo - aSoFar;
                    return (
                      <tr key={m.id}>
                        <td>{formatDate(m.date)}</td>
                        <td>
                          <span className={m.winnerName === h2h.a ? "win-a" : "win-b"} style={{ fontWeight: 700 }}>
                            <Link
                              className="player-link"
                              to={`/player/${encodeURIComponent(m.winnerName)}`}
                            >
                              <PlayerName name={m.winnerName} />
                            </Link>
                          </span>
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>
                          {m.score ?? "—"}
                          {m.tournament && (
                            <span className="badge gold" style={{ marginLeft: 8, fontSize: 11 }}>
                              🏆 {m.tournament}
                            </span>
                          )}
                        </td>
                        <td
                          className={`num ${aSoFar > bSoFar ? "win-a" : bSoFar > aSoFar ? "win-b" : ""}`}
                          style={{
                            fontFamily: "var(--mono)",
                            fontWeight: 700,
                            color: aSoFar === bSoFar ? "var(--text-dim)" : undefined,
                          }}
                          title={`${h2h.a} ${aSoFar} – ${bSoFar} ${h2h.b}`}
                        >
                          {aSoFar}–{bSoFar}
                        </td>
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
