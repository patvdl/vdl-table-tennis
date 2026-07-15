import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { computeRecords } from "../lib/records";
import { RATED_MIN } from "../lib/elo";
import { formatDate, round0 } from "../lib/format";
import Avatar from "../components/Avatar";

const TOP_N = 5;

function PlayerLink({ name }: { name: string }) {
  return (
    <Link className="player-link" to={`/player/${encodeURIComponent(name)}`}>
      {name}
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

export default function Records() {
  const { replayResult } = useMatches();
  const records = useMemo(() => computeRecords(replayResult.enriched), [replayResult]);

  const topWin = records.winStreaks[0];
  const topLoss = records.lossStreaks[0];
  const topUpset = records.upsets[0];
  const topHigh = records.highest[0];
  const topLow = records.lowest[0];
  const topReign = records.reigns[0];

  const streakWhen = (s: { start: string; end: string | null }) =>
    `${formatDate(s.start)} → ${s.end ? formatDate(s.end) : "still active"}`;

  return (
    <div className="records-grid">
      <div className="card">
        <h2>Longest win streak</h2>
        <p className="sub">Most consecutive wins against anyone, all-time.</p>
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
                  {records.winStreaks.slice(0, TOP_N).map((s, i) => (
                    <tr key={s.player}>
                      <td className="rank-cell">{i + 1}</td>
                      <td>
                        <PlayerLink name={s.player} />
                      </td>
                      <td className="num">
                        <span className="badge up">W{s.length}</span>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{streakWhen(s)}</td>
                    </tr>
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
        <h2>Longest losing streak</h2>
        <p className="sub">Most consecutive losses against anyone, all-time.</p>
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
                  {records.lossStreaks.slice(0, TOP_N).map((s, i) => (
                    <tr key={s.player}>
                      <td className="rank-cell">{i + 1}</td>
                      <td>
                        <PlayerLink name={s.player} />
                      </td>
                      <td className="num">
                        <span className="badge down">L{s.length}</span>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{streakWhen(s)}</td>
                    </tr>
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
                    <tr key={r.player}>
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
                    </tr>
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
