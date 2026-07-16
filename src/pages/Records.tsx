import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { computeRecords } from "../lib/records";
import type { RankSpan, StreakRecord } from "../lib/records";
import { RATED_MIN } from "../lib/elo";
import { formatDate, pct, round0 } from "../lib/format";
import Avatar from "../components/Avatar";
import PlayerName from "../components/PlayerName";

const TOP_N = 5;

function PlayerLink({ name }: { name: string }) {
  return (
    <Link className="player-link" to={`/player/${encodeURIComponent(name)}`}>
      <PlayerName name={name} />
    </Link>
  );
}

function Hero({
  player,
  value,
  valueClass,
  context,
}: {
  player: string;
  value: string;
  valueClass?: string;
  context: string;
}) {
  return (
    <div className="record-hero">
      <Avatar player={player} size={64} />
      <div>
        <div className={`record-value ${valueClass ?? ""}`}>{value}</div>
        <div className="record-context">
          <PlayerLink name={player} /> · {context}
        </div>
      </div>
    </div>
  );
}

/** Keep only each player's first (= best, lists are sorted) entry */
function bestPerPlayer(list: StreakRecord[]): StreakRecord[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.player) ? false : (seen.add(s.player), true)));
}

export default function Records() {
  const { replayResult } = useMatches();
  const records = useMemo(() => computeRecords(replayResult.enriched), [replayResult]);

  const [uniqueWins, setUniqueWins] = useState(false);
  const [uniqueLosses, setUniqueLosses] = useState(false);
  const [expandedKiller, setExpandedKiller] = useState<string | null>(null);
  const [expandedReign, setExpandedReign] = useState<string | null>(null);
  const [expandedTopFive, setExpandedTopFive] = useState<string | null>(null);
  const [expandedWinRun, setExpandedWinRun] = useState<number | null>(null);
  const [expandedLossRun, setExpandedLossRun] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);

  const seasons = records.seasons;
  const season =
    seasons.find((s) => s.year === selYear) ?? seasons[seasons.length - 1] ?? null;
  const poty = season?.winner ?? null;

  const winList = uniqueWins ? bestPerPlayer(records.winStreaks) : records.winStreaks;
  const lossList = uniqueLosses ? bestPerPlayer(records.lossStreaks) : records.lossStreaks;

  const topWin = records.winStreaks[0];
  const topLoss = records.lossStreaks[0];
  const topUpset = records.upsets[0];
  const topHigh = records.highest[0];
  const topLow = records.lowest[0];
  const topReign = records.reigns[0];
  const topFive = records.topFive[0];
  const topKiller = records.giantKillers[0];
  const killerLeaders = topKiller
    ? records.giantKillers.filter((g) => g.wins === topKiller.wins)
    : [];

  const streakWhen = (s: { start: string; end: string | null }) =>
    `${formatDate(s.start)} → ${s.end ? formatDate(s.end) : "still active"}`;

  const spanLine = (s: RankSpan) =>
    `${formatDate(s.start)} → ${s.end ? formatDate(s.end) : "present"} · ${s.days} ${
      s.days === 1 ? "day" : "days"
    }`;

  return (
    <div className="records-grid">
      {season && (
        <div className="card records-span">
          <div className="card-head">
            <h2>Player of the Year</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {seasons.map((s) => (
                <button
                  key={s.year}
                  className={`btn ${season.year === s.year ? "" : "ghost"}`}
                  style={{ padding: "4px 14px", fontSize: 12 }}
                  onClick={() => setSelYear(s.year)}
                >
                  {s.year}
                </button>
              ))}
            </div>
          </div>
          <p className="sub">
            Judged on the whole season, quality over quantity: win rate, time spent at
            #1 and in the top 5, and peak rating carry the most weight, with quality of
            wins (beating top-5 and #1 ranked players) and win count behind them. Every
            rated player who played that year is in the race.
            {season.inProgress &&
              " This season is still in progress — the race can change with every match."}
          </p>

          {poty && (
            <>
              <div className="record-hero">
                <div style={{ position: "relative" }}>
                  <Avatar player={poty.player} size={96} />
                  <span
                    style={{
                      position: "absolute",
                      top: -16,
                      left: -8,
                      fontSize: 30,
                      transform: "rotate(-24deg)",
                      textShadow: "0 2px 6px rgba(0,0,0,0.6)",
                    }}
                    aria-hidden
                  >
                    👑
                  </span>
                </div>
                <div>
                  <div className="record-context">
                    🏆 Player of the Year {season.year}
                    {season.inProgress && " · so far"}
                  </div>
                  <div className="record-value" style={{ fontSize: 30 }}>
                    <PlayerLink name={poty.player} /> <span aria-hidden>👑</span>
                  </div>
                  <div className="record-context">season score {poty.score} / 100</div>
                </div>
              </div>

              <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat-tile">
                  <div className="label">Record</div>
                  <div className="value">
                    <span style={{ color: "var(--green)" }}>{poty.wins}</span>–
                    <span style={{ color: "var(--red)" }}>{poty.losses}</span>
                  </div>
                  <div className="hint">{pct(poty.winPct)} win rate</div>
                </div>
                <div className="stat-tile">
                  <div className="label">Days at #1</div>
                  <div className="value">{poty.daysAtNo1}</div>
                  <div className="hint">during {season.year}</div>
                </div>
                <div className="stat-tile">
                  <div className="label">Days in top 5</div>
                  <div className="value">{poty.daysTop5}</div>
                  <div className="hint">during {season.year}</div>
                </div>
                <div className="stat-tile">
                  <div className="label">Top-5 wins</div>
                  <div className="value">{poty.topFiveWins}</div>
                  <div className="hint">{poty.no1Wins} over the #1</div>
                </div>
                <div className="stat-tile">
                  <div className="label">Best win</div>
                  {poty.bestWin ? (
                    <>
                      <div className="value">#{poty.bestWin.opponentRank}</div>
                      <div className="hint">
                        beat <PlayerName name={poty.bestWin.opponent} /> ·{" "}
                        {formatDate(poty.bestWin.date)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="value">—</div>
                      <div className="hint">no ranked wins</div>
                    </>
                  )}
                </div>
                <div className="stat-tile">
                  <div className="label">Peak rating</div>
                  <div className="value">
                    {poty.peakRating !== null ? round0(poty.peakRating) : "—"}
                  </div>
                  <div className="hint">highest during {season.year}</div>
                </div>
                <div className="stat-tile">
                  <div className="label">{season.inProgress ? "Current rank" : "Year-end rank"}</div>
                  <div className="value">{poty.endRank !== null ? `#${poty.endRank}` : "—"}</div>
                  <div className="hint">
                    {poty.endRating !== null ? `rating ${round0(poty.endRating)}` : "unranked"}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th>Player</th>
                      <th className="num">Record</th>
                      <th className="num">Win %</th>
                      <th className="num">Top-5 wins</th>
                      <th className="num">Days at #1</th>
                      <th className="num">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.standings.slice(0, 10).map((s, i) => (
                      <tr key={s.player}>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <PlayerLink name={s.player} />{" "}
                          {s.player === poty.player && <span aria-hidden>👑</span>}
                        </td>
                        <td className="num" style={{ fontFamily: "var(--mono)" }}>
                          {s.wins}–{s.losses}
                        </td>
                        <td className="num">{pct(s.winPct)}</td>
                        <td className="num">{s.topFiveWins}</td>
                        <td className="num">{s.daysAtNo1}</td>
                        <td className="num" style={{ fontFamily: "var(--mono)" }}>
                          {s.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Longest win streak</h2>
          <button
            className="btn ghost"
            style={{ padding: "3px 10px", fontSize: 11 }}
            onClick={() => {
              setUniqueWins((v) => !v);
              setExpandedWinRun(null);
            }}
          >
            {uniqueWins ? "Show every streak" : "Best per player"}
          </button>
        </div>
        <p className="sub">
          {uniqueWins
            ? "Each player's single best run of consecutive wins."
            : "Most consecutive wins against anyone. Every run counts on its own, so one player can hold several spots."}
        </p>
        {topWin ? (
          <>
            <Hero
              player={topWin.player}
              value={`${topWin.length} wins`}
              valueClass="delta-up"
              context={streakWhen(topWin)}
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {winList.slice(0, TOP_N).map((s, i) => (
                    <Fragment key={i}>
                      <tr>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <PlayerLink name={s.player} />
                        </td>
                        <td className="num">
                          <span className="badge up">W{s.length}</span>
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>{streakWhen(s)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn ghost"
                            style={{ padding: "2px 10px", fontSize: 11 }}
                            onClick={() => setExpandedWinRun(expandedWinRun === i ? null : i)}
                          >
                            {expandedWinRun === i ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expandedWinRun === i && (
                        <tr>
                          <td />
                          <td colSpan={4}>
                            <div
                              style={{
                                display: "grid",
                                gap: 4,
                                padding: "2px 0 10px",
                                fontSize: 13,
                                color: "var(--text-dim)",
                              }}
                            >
                              {s.matches.map((m, j) => (
                                <div key={m.id}>
                                  <span className="rank-cell">{j + 1}.</span>{" "}
                                  {formatDate(m.date)} — beat{" "}
                                  <PlayerLink
                                    name={m.player1 === s.player ? m.player2 : m.player1}
                                  />
                                  {m.score ? ` ${m.score}` : ""}
                                  {m.tournament && (
                                    <span
                                      className="badge gold"
                                      style={{ marginLeft: 8, fontSize: 11 }}
                                    >
                                      🏆 {m.tournament}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">No matches yet.</p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Longest losing streak</h2>
          <button
            className="btn ghost"
            style={{ padding: "3px 10px", fontSize: 11 }}
            onClick={() => {
              setUniqueLosses((v) => !v);
              setExpandedLossRun(null);
            }}
          >
            {uniqueLosses ? "Show every streak" : "Best per player"}
          </button>
        </div>
        <p className="sub">
          {uniqueLosses
            ? "Each player's single worst run of consecutive losses."
            : "Most consecutive losses against anyone. Every run counts on its own, so one player can hold several spots."}
        </p>
        {topLoss ? (
          <>
            <Hero
              player={topLoss.player}
              value={`${topLoss.length} losses`}
              valueClass="delta-down"
              context={streakWhen(topLoss)}
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {lossList.slice(0, TOP_N).map((s, i) => (
                    <Fragment key={i}>
                      <tr>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <PlayerLink name={s.player} />
                        </td>
                        <td className="num">
                          <span className="badge down">L{s.length}</span>
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>{streakWhen(s)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn ghost"
                            style={{ padding: "2px 10px", fontSize: 11 }}
                            onClick={() => setExpandedLossRun(expandedLossRun === i ? null : i)}
                          >
                            {expandedLossRun === i ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expandedLossRun === i && (
                        <tr>
                          <td />
                          <td colSpan={4}>
                            <div
                              style={{
                                display: "grid",
                                gap: 4,
                                padding: "2px 0 10px",
                                fontSize: 13,
                                color: "var(--text-dim)",
                              }}
                            >
                              {s.matches.map((m, j) => (
                                <div key={m.id}>
                                  <span className="rank-cell">{j + 1}.</span>{" "}
                                  {formatDate(m.date)} — lost to{" "}
                                  <PlayerLink name={m.winnerName} />
                                  {m.score ? ` ${m.score}` : ""}
                                  {m.tournament && (
                                    <span
                                      className="badge gold"
                                      style={{ marginLeft: 8, fontSize: 11 }}
                                    >
                                      🏆 {m.tournament}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">No matches yet.</p>
        )}
      </div>

      <div className="card">
        <h2>Most days at #1</h2>
        <p className="sub">Total days spent holding the top spot on the leaderboard.</p>
        {topReign ? (
          <>
            <Hero
              player={topReign.player}
              value={`${topReign.days} days`}
              context={
                topReign.current
                  ? `current #1 since ${formatDate(topReign.since)} · ${topReign.reigns} ${
                      topReign.reigns === 1 ? "reign" : "reigns"
                    }`
                  : `${topReign.reigns} ${topReign.reigns === 1 ? "reign" : "reigns"}`
              }
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {records.reigns.slice(0, TOP_N).map((r, i) => (
                    <Fragment key={r.player}>
                      <tr>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <PlayerLink name={r.player} />{" "}
                          {r.current && <span className="badge gold">current #1</span>}
                        </td>
                        <td className="num" style={{ fontFamily: "var(--mono)" }}>
                          {r.days} {r.days === 1 ? "day" : "days"}
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>
                          {r.reigns} {r.reigns === 1 ? "reign" : "reigns"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn ghost"
                            style={{ padding: "2px 10px", fontSize: 11 }}
                            onClick={() =>
                              setExpandedReign(expandedReign === r.player ? null : r.player)
                            }
                          >
                            {expandedReign === r.player ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expandedReign === r.player && (
                        <tr>
                          <td />
                          <td colSpan={4}>
                            <div
                              style={{
                                display: "grid",
                                gap: 4,
                                padding: "2px 0 10px",
                                fontSize: 13,
                                color: "var(--text-dim)",
                              }}
                            >
                              {r.spans.map((s, j) => (
                                <div key={j}>{spanLine(s)}</div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">Nobody has been ranked yet.</p>
        )}
      </div>

      <div className="card">
        <h2>Most days in the top 5</h2>
        <p className="sub">Total days spent ranked among the leaderboard's top 5 players.</p>
        {topFive ? (
          <>
            <Hero
              player={topFive.player}
              value={`${topFive.days} days`}
              context={topFive.current ? "currently in the top 5" : "not currently in the top 5"}
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {records.topFive.slice(0, TOP_N).map((t, i) => (
                    <Fragment key={t.player}>
                      <tr>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <PlayerLink name={t.player} />{" "}
                          {t.current && <span className="badge neutral">current top 5</span>}
                        </td>
                        <td className="num" style={{ fontFamily: "var(--mono)" }}>
                          {t.days} {t.days === 1 ? "day" : "days"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn ghost"
                            style={{ padding: "2px 10px", fontSize: 11 }}
                            onClick={() =>
                              setExpandedTopFive(expandedTopFive === t.player ? null : t.player)
                            }
                          >
                            {expandedTopFive === t.player ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expandedTopFive === t.player && (
                        <tr>
                          <td />
                          <td colSpan={3}>
                            <div
                              style={{
                                display: "grid",
                                gap: 4,
                                padding: "2px 0 10px",
                                fontSize: 13,
                                color: "var(--text-dim)",
                              }}
                            >
                              {t.spans.map((s, j) => (
                                <div key={j}>{spanLine(s)}</div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">Nobody has been ranked yet.</p>
        )}
      </div>

      <div className="card">
        <h2>Biggest upset</h2>
        <p className="sub">
          The most improbable win ever recorded — judged by what the win predictor
          would have said just before the match, using only what was known at the
          time. Counts matches where both players were rated.
        </p>
        {topUpset ? (
          <>
            <Hero
              player={topUpset.winner}
              value={`${(topUpset.winProb * 100).toFixed(1)}% chance`}
              context={`beat ${topUpset.loser}${
                topUpset.match.score ? ` ${topUpset.match.score}` : ""
              } · ${formatDate(topUpset.match.date)} · rated ${round0(
                topUpset.winnerRating,
              )} vs ${round0(topUpset.loserRating)}`}
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {records.upsets.slice(0, TOP_N).map((u, i) => (
                    <tr key={u.match.id}>
                      <td className="rank-cell">{i + 1}</td>
                      <td>
                        <PlayerLink name={u.winner} />{" "}
                        <span style={{ color: "var(--text-dim)" }}>beat</span>{" "}
                        <PlayerLink name={u.loser} />
                      </td>
                      <td className="num" style={{ fontFamily: "var(--mono)" }}>
                        {(u.winProb * 100).toFixed(1)}%
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{formatDate(u.match.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">No upsets between rated players yet.</p>
        )}
      </div>

      <div className="card">
        <h2>Most wins over the #1</h2>
        <p className="sub">
          Career wins against whoever was ranked #1 at the time — beating the best
          while they were the best.
        </p>
        {topKiller ? (
          <>
            {killerLeaders.length > 1 ? (
              <div className="record-hero">
                <div style={{ display: "flex" }}>
                  {killerLeaders.map((g, i) => (
                    <span
                      key={g.player}
                      style={{
                        position: "relative",
                        marginLeft: i ? -16 : 0,
                        zIndex: killerLeaders.length - i,
                      }}
                    >
                      <Avatar player={g.player} size={64} />
                    </span>
                  ))}
                </div>
                <div>
                  <div className="record-value">
                    {topKiller.wins} wins each{" "}
                    <span className="badge neutral" style={{ verticalAlign: "middle" }}>
                      tied
                    </span>
                  </div>
                  <div className="record-context">
                    {killerLeaders.map((g, i) => (
                      <Fragment key={g.player}>
                        {i > 0 && (i === killerLeaders.length - 1 ? " and " : ", ")}
                        <PlayerLink name={g.player} />
                      </Fragment>
                    ))}{" "}
                    share the record
                  </div>
                </div>
              </div>
            ) : (
              <Hero
                player={topKiller.player}
                value={`${topKiller.wins} ${topKiller.wins === 1 ? "win" : "wins"}`}
                context={`${topKiller.victims
                  .map((v) => `${v.count}× vs ${v.name}`)
                  .join(" · ")} · latest ${formatDate(topKiller.latest)}`}
              />
            )}
            <div className="table-wrap">
              <table>
                <tbody>
                  {records.giantKillers.slice(0, TOP_N).map((g, i) => (
                    <Fragment key={g.player}>
                      <tr>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <PlayerLink name={g.player} />
                        </td>
                        <td className="num" style={{ fontFamily: "var(--mono)" }}>
                          {g.wins} {g.wins === 1 ? "win" : "wins"}
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>
                          latest {formatDate(g.latest)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn ghost"
                            style={{ padding: "2px 10px", fontSize: 11 }}
                            onClick={() =>
                              setExpandedKiller(expandedKiller === g.player ? null : g.player)
                            }
                          >
                            {expandedKiller === g.player ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expandedKiller === g.player && (
                        <tr>
                          <td />
                          <td colSpan={4}>
                            <div
                              style={{
                                display: "grid",
                                gap: 4,
                                padding: "2px 0 10px",
                                fontSize: 13,
                                color: "var(--text-dim)",
                              }}
                            >
                              {g.victories.map((v) => (
                                <div key={v.id}>
                                  {formatDate(v.date)} — beat{" "}
                                  <PlayerLink name={v.loserName} />
                                  {v.score ? ` ${v.score}` : ""}
                                  {v.tournament && (
                                    <span
                                      className="badge gold"
                                      style={{ marginLeft: 8, fontSize: 11 }}
                                    >
                                      🏆 {v.tournament}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">Nobody has beaten a reigning #1 yet.</p>
        )}
      </div>

      <div className="card">
        <h2>Highest rating ever</h2>
        <p className="sub">The best rating anyone has ever held while ranked.</p>
        {topHigh ? (
          <>
            <Hero
              player={topHigh.player}
              value={round0(topHigh.rating)}
              context={`reached ${formatDate(topHigh.date)}`}
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {records.highest.slice(0, TOP_N).map((r, i) => (
                    <tr key={r.player}>
                      <td className="rank-cell">{i + 1}</td>
                      <td>
                        <PlayerLink name={r.player} />
                      </td>
                      <td className="num rating">{round0(r.rating)}</td>
                      <td style={{ color: "var(--text-dim)" }}>{formatDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">Nobody has been ranked yet — players need {RATED_MIN} matches.</p>
        )}
      </div>

      <div className="card">
        <h2>Lowest rating ever</h2>
        <p className="sub">The lowest rating anyone has ever held while ranked.</p>
        {topLow ? (
          <>
            <Hero
              player={topLow.player}
              value={round0(topLow.rating)}
              context={`hit ${formatDate(topLow.date)}`}
            />
            <div className="table-wrap">
              <table>
                <tbody>
                  {records.lowest.slice(0, TOP_N).map((r, i) => (
                    <tr key={r.player}>
                      <td className="rank-cell">{i + 1}</td>
                      <td>
                        <PlayerLink name={r.player} />
                      </td>
                      <td className="num rating">{round0(r.rating)}</td>
                      <td style={{ color: "var(--text-dim)" }}>{formatDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="sub">Nobody has been ranked yet — players need {RATED_MIN} matches.</p>
        )}
      </div>
    </div>
  );
}
