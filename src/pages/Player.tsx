import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMatches } from "../store/matches";
import { headToHead, RATED_MIN, START_RATING } from "../lib/elo";
import { playerStreaks, bestCareerWin, standingsFor } from "../lib/records";
import type { RankSpan, StreakRecord } from "../lib/records";
import { formatDate, round0, pct, signed } from "../lib/format";
import Sparkline from "../components/Sparkline";
import FormChart from "../components/FormChart";
import StreakBadge from "../components/StreakBadge";
import Trophy from "../components/Trophy";
import Crowns from "../components/Crowns";
import Delta from "../components/Delta";
import Avatar from "../components/Avatar";
import PlayerName from "../components/PlayerName";
import PlayerActions from "../components/PlayerActions";

const RECENT = 5;

export default function PlayerPage() {
  const { name = "" } = useParams();
  const player = decodeURIComponent(name);
  const navigate = useNavigate();
  const { board, replayResult, tournaments, playerNames } = useMatches();
  const titles = tournaments.filter((t) => t.champion === player);

  const playerActions = (
    <PlayerActions
      player={player}
      onRenamed={(n) => navigate(`/player/${encodeURIComponent(n)}`, { replace: true })}
      onDeleted={() => navigate("/", { replace: true })}
    />
  );

  const stats = replayResult.stats.get(player);
  const rank = board.findIndex((p) => p.name === player) + 1;
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [streakModal, setStreakModal] = useState<"win" | "loss" | null>(null);
  const [spansModal, setSpansModal] = useState<"no1" | "top5" | null>(null);

  const streaks = useMemo(
    () => playerStreaks(replayResult.enriched, player),
    [player, replayResult],
  );
  const bestWin = useMemo(
    () => bestCareerWin(replayResult.enriched, player),
    [player, replayResult],
  );

  // Time spent at #1 and in the top 5, same numbers as the Records page
  const standings = useMemo(() => {
    const { reigns, topFive } = standingsFor(replayResult.enriched);
    return {
      no1: reigns.find((r) => r.player === player) ?? null,
      top5: topFive.find((t) => t.player === player) ?? null,
    };
  }, [player, replayResult]);

  // Oldest first, for the form chart
  const chronological = useMemo(
    () => replayResult.enriched.filter((m) => m.player1 === player || m.player2 === player),
    [player, replayResult],
  );
  const myMatches = useMemo(() => [...chronological].reverse(), [chronological]); // newest first

  // Career-low rating. Like the record book, only rated moments count —
  // the swings of the first couple of provisional games don't set records.
  const lowest = useMemo(() => {
    let low: { rating: number; date: string } | null = null;
    for (let i = 0; i < chronological.length; i++) {
      if (i + 1 < RATED_MIN) continue;
      const m = chronological[i];
      const after = m.player1 === player ? m.rating1After : m.rating2After;
      if (!low || after < low.rating) low = { rating: after, date: m.date };
    }
    return low;
  }, [chronological, player]);

  const rivals = useMemo(() => {
    if (!stats) return [];
    const opponents = new Set<string>();
    for (const m of replayResult.enriched) {
      if (m.player1 === player) opponents.add(m.player2);
      if (m.player2 === player) opponents.add(m.player1);
    }
    return [...opponents]
      .map((o) => headToHead(replayResult.enriched, player, o))
      .sort((x, y) => y.total - x.total);
  }, [player, stats, replayResult]);

  if (!stats) {
    const isRegistered = playerNames.includes(player);
    return (
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Avatar player={player} size={240} />
          <div>
            <h2 style={{ marginBottom: 2 }}>
              <PlayerName name={player} />{" "}
              {isRegistered && <span className="badge neutral">Unrated</span>}
              {isRegistered && playerActions}
            </h2>
            <p className="sub" style={{ margin: 0 }}>
              {isRegistered
                ? "No matches yet — they'll join the rankings once they start playing."
                : "No matches found for this player."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isRated = stats.played >= RATED_MIN;

  return (
    <>
      <div className="card">
        <div className="profile-hero">
          <Avatar player={player} size={240} />
          <div className="profile-hero-main">
            <h2 style={{ marginBottom: 2 }}>
              <PlayerName name={player} />{" "}
              {isRated ? (
                <span className={`badge ${rank === 1 ? "gold" : "neutral"}`}>#{rank}</span>
              ) : (
                <span className="badge neutral">Unrated</span>
              )}
              <Crowns player={player} />
              <Trophy player={player} />
              {playerActions}
            </h2>
            <p className="sub" style={{ margin: 0 }}>Full career profile</p>
            {!isRated && (
              <p className="sub" style={{ margin: "8px 0 0" }}>
                Ranked after {RATED_MIN - stats.played} more{" "}
                {RATED_MIN - stats.played === 1 ? "match" : "matches"}.
              </p>
            )}
          </div>
        </div>

        <div className="stat-groups">
          <div className="stat-group">
            <div className="group-title">Rating</div>
            <div className="group-hero">
              <span className="big">{isRated ? round0(stats.rating) : "—"}</span>
              <span className="ctx">current</span>
            </div>
            <div className="sg-row">
              <span className="k">Peak</span>
              <span className="v">
                {isRated ? (
                  <>
                    <span className="mono">{round0(stats.peakRating)}</span>
                    <span className="hint">
                      {" "}
                      ·{" "}
                      {stats.peakRating > START_RATING
                        ? formatDate(stats.peakDate)
                        : `at start rating since ${formatDate(stats.peakDate)}`}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="sg-row">
              <span className="k">Lowest</span>
              <span className="v">
                {isRated && lowest ? (
                  <>
                    <span className="mono">{round0(lowest.rating)}</span>
                    <span className="hint"> · {formatDate(lowest.date)}</span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>

          <div className="stat-group">
            <div className="group-title">Record</div>
            <div className="group-hero">
              <span className="big">
                <span style={{ color: "var(--green)" }}>{stats.wins}</span>–
                <span style={{ color: "var(--red)" }}>{stats.losses}</span>
              </span>
              <span className="ctx">{pct(stats.wins / Math.max(stats.played, 1))} win rate</span>
            </div>
            <div className="sg-row">
              <span className="k">Matches</span>
              <span className="v">
                <span className="mono">{stats.played}</span>
              </span>
            </div>
            <div className="sg-row">
              <span className="k">Last played</span>
              <span className="v">{formatDate(stats.lastPlayed)}</span>
            </div>
          </div>

          <div className="stat-group">
            <div className="group-title">Time at the top</div>
            <div className="group-hero">
              <span className="big">{standings.no1 ? standings.no1.days : "—"}</span>
              <span className="ctx">
                days at #1
                {standings.no1 && (
                  <>
                    {" "}
                    · {standings.no1.spans.length}{" "}
                    {standings.no1.spans.length === 1 ? "stint" : "stints"}{" "}
                    <button className="link-btn" onClick={() => setSpansModal("no1")}>
                      details
                    </button>
                  </>
                )}
              </span>
            </div>
            <div className="sg-row">
              <span className="k">Days in top 5</span>
              <span className="v">
                {standings.top5 ? (
                  <>
                    <span className="mono">{standings.top5.days}</span>
                    <span className="hint">
                      {" "}
                      · {standings.top5.spans.length}{" "}
                      {standings.top5.spans.length === 1 ? "stint" : "stints"}
                    </span>{" "}
                    <button className="link-btn" onClick={() => setSpansModal("top5")}>
                      details
                    </button>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="sg-row">
              <span className="k">Career-high rank</span>
              <span className="v">
                {stats.bestRankDate ? (
                  <>
                    <span className="mono">#{stats.bestRank}</span>
                    <span className="hint"> · {formatDate(stats.bestRankDate)}</span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>

          <div className="stat-group">
            <div className="group-title">Streaks</div>
            <div className="group-hero">
              <span className="big">
                <StreakBadge streak={stats.streak} />
              </span>
              <span className="ctx">current</span>
            </div>
            <div className="sg-row">
              <span className="k">Best</span>
              <span className="v">
                {streaks.bestWin ? (
                  <>
                    <span className="mono" style={{ color: "var(--green)" }}>
                      W{streaks.bestWin.length}
                    </span>
                    <span className="hint">
                      {" "}
                      · {formatDate(streaks.bestWin.start)} →{" "}
                      {streaks.bestWin.end
                        ? formatDate(streaks.bestWin.end)
                        : "still active"}
                    </span>{" "}
                    <button className="link-btn" onClick={() => setStreakModal("win")}>
                      details
                    </button>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="sg-row">
              <span className="k">Worst</span>
              <span className="v">
                {streaks.worstLoss ? (
                  <>
                    <span className="mono" style={{ color: "var(--red)" }}>
                      L{streaks.worstLoss.length}
                    </span>
                    <span className="hint">
                      {" "}
                      · {formatDate(streaks.worstLoss.start)} →{" "}
                      {streaks.worstLoss.end
                        ? formatDate(streaks.worstLoss.end)
                        : "still active"}
                    </span>{" "}
                    <button className="link-btn" onClick={() => setStreakModal("loss")}>
                      details
                    </button>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>

          <div className="stat-group">
            <div className="group-title">Highlights</div>
            <div className="group-hero">
              {bestWin ? (
                <>
                  <span className="big">#{bestWin.opponentRank}</span>
                  <span className="ctx">
                    best win — beat <PlayerName name={bestWin.match.loserName} /> ·{" "}
                    {formatDate(bestWin.match.date)}
                    {bestWin.match.score ? ` · ${bestWin.match.score}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span className="big">—</span>
                  <span className="ctx">no wins over ranked players yet</span>
                </>
              )}
            </div>
            <div className="sg-row">
              <span className="k">Tournament titles</span>
              <span className="v">
                {titles.length > 0 ? (
                  <>
                    <span className="mono">{titles.length}</span>
                    <span className="hint">
                      {" "}
                      · {titles.map((t) => t.name).join(" · ")}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>
        </div>
        {isRated && (
          <div style={{ marginTop: 18 }}>
            <label className="field">Rating over time ({stats.played} matches)</label>
            <Sparkline values={stats.history} width={640} height={80} fluid />
          </div>
        )}
        {isRated && (
          <div style={{ marginTop: 18 }}>
            <label className="field">
              Career form — wins {stats.wins} · losses {stats.losses}
            </label>
            <FormChart matches={chronological} player={player} />
          </div>
        )}
      </div>

      <div className="card">
        <h2>Match history</h2>
        <p className="sub">
          {showAllMatches || myMatches.length <= RECENT
            ? `All ${myMatches.length} of ${player}'s matches, newest first.`
            : `${player}'s last ${RECENT} matches.`}
        </p>
        <div className="table-wrap pin-1">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Result</th>
                <th>Opponent</th>
                <th>Score</th>
                <th className="num">ELO change</th>
                <th className="num">Rating after</th>
              </tr>
            </thead>
            <tbody>
              {(showAllMatches ? myMatches : myMatches.slice(0, RECENT)).map((m) => {
                const isP1 = m.player1 === player;
                const opponent = isP1 ? m.player2 : m.player1;
                const delta = isP1
                  ? m.rating1After - m.rating1Before
                  : m.rating2After - m.rating2Before;
                const after = isP1 ? m.rating1After : m.rating2After;
                const won = m.winnerName === player;
                return (
                  <tr key={m.id}>
                    <td>{formatDate(m.date)}</td>
                    <td>
                      <span className={`badge ${won ? "up" : "down"}`}>
                        {won ? "Won" : "Lost"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="player-link"
                        to={`/player/${encodeURIComponent(opponent)}`}
                      >
                        <PlayerName name={opponent} />
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
                    <td className="num">
                      <Delta value={delta} />
                    </td>
                    <td className="num rating">{round0(after)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {myMatches.length > RECENT && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              className="btn ghost"
              onClick={() => setShowAllMatches((s) => !s)}
            >
              {showAllMatches
                ? `Show last ${RECENT} only`
                : `Show all ${myMatches.length} matches`}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Rivalries</h2>
        <p className="sub">Head-to-head record against every opponent.</p>
        <div className="table-wrap pin-1">
          <table>
            <thead>
              <tr>
                <th>Opponent</th>
                <th className="num">Played</th>
                <th className="num">Won</th>
                <th className="num">Lost</th>
                <th className="num">Win %</th>
                <th>Streak</th>
                <th className="num">Net ELO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rivals.map((h) => (
                <tr key={h.b}>
                  <td>
                    <Link className="player-link" to={`/player/${encodeURIComponent(h.b)}`}>
                      <PlayerName name={h.b} />
                    </Link>
                  </td>
                  <td className="num">{h.total}</td>
                  <td className="num" style={{ color: "var(--green)" }}>
                    {h.winsA}
                  </td>
                  <td className="num" style={{ color: "var(--red)" }}>
                    {h.winsB}
                  </td>
                  <td className="num">{pct(h.winsA / h.total)}</td>
                  <td>
                    {h.streakHolder === player ? (
                      <span className="badge up">W{h.streakLength}</span>
                    ) : (
                      <span className="badge down">L{h.streakLength}</span>
                    )}
                  </td>
                  <td className={`num ${h.ratingSwingA >= 0 ? "delta-up" : "delta-down"}`}>
                    {signed(h.ratingSwingA)}
                  </td>
                  <td>
                    <Link
                      className="btn ghost"
                      style={{ padding: "4px 12px", fontSize: 12 }}
                      to={`/head-to-head?a=${encodeURIComponent(player)}&b=${encodeURIComponent(h.b)}`}
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {streakModal && (
        <StreakModal
          player={player}
          kind={streakModal}
          streak={streakModal === "win" ? streaks.bestWin! : streaks.worstLoss!}
          onClose={() => setStreakModal(null)}
        />
      )}

      {spansModal && (
        <SpansModal
          title={spansModal === "no1" ? "Days at #1" : "Days in the top 5"}
          totalDays={(spansModal === "no1" ? standings.no1! : standings.top5!).days}
          spans={(spansModal === "no1" ? standings.no1! : standings.top5!).spans}
          onClose={() => setSpansModal(null)}
        />
      )}
    </>
  );
}

/** Every stint a player spent at #1 (or in the top 5), with dates */
function SpansModal({
  title,
  totalDays,
  spans,
  onClose,
}: {
  title: string;
  totalDays: number;
  spans: RankSpan[];
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {title} — {totalDays} {totalDays === 1 ? "day" : "days"}
        </h2>
        <p className="sub">
          {spans.length} {spans.length === 1 ? "stint" : "stints"}, oldest first.
        </p>
        <div
          style={{
            display: "grid",
            gap: 5,
            fontSize: 13,
            color: "var(--text-dim)",
            maxHeight: "55vh",
            overflowY: "auto",
          }}
        >
          {spans.map((s, i) => (
            <div key={i}>
              <span className="rank-cell">{i + 1}.</span> {formatDate(s.start)} →{" "}
              {s.end ? formatDate(s.end) : "present"} ·{" "}
              <span style={{ color: "var(--text)" }}>
                {s.days} {s.days === 1 ? "day" : "days"}
              </span>
              {!s.end && (
                <span className="badge gold" style={{ marginLeft: 8, fontSize: 11 }}>
                  ongoing
                </span>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Every match inside a streak, plus the one that broke it */
function StreakModal({
  player,
  kind,
  streak,
  onClose,
}: {
  player: string;
  kind: "win" | "loss";
  streak: StreakRecord;
  onClose: () => void;
}) {
  const won = kind === "win";
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {won ? "Best win streak" : "Worst losing streak"} —{" "}
          <span className={won ? "win-a" : "delta-down"}>
            {won ? "W" : "L"}
            {streak.length}
          </span>
        </h2>
        <p className="sub">
          {formatDate(streak.start)} → {streak.end ? formatDate(streak.end) : "still active"}
        </p>
        <div
          style={{
            display: "grid",
            gap: 5,
            fontSize: 13,
            color: "var(--text-dim)",
            maxHeight: "55vh",
            overflowY: "auto",
          }}
        >
          {streak.matches.map((m, i) => {
            const opponent = m.player1 === player ? m.player2 : m.player1;
            return (
              <div key={m.id}>
                <span className="rank-cell">{i + 1}.</span> {formatDate(m.date)} —{" "}
                {won ? "beat" : "lost to"}{" "}
                <Link className="player-link" to={`/player/${encodeURIComponent(opponent)}`}>
                  <PlayerName name={opponent} />
                </Link>
                {m.score ? ` ${m.score}` : ""}
                {m.tournament && (
                  <span className="badge gold" style={{ marginLeft: 8, fontSize: 11 }}>
                    🏆 {m.tournament}
                  </span>
                )}
              </div>
            );
          })}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 3 }}>
            {streak.endedBy ? (
              <>
                <span className={`badge ${won ? "down" : "up"}`} style={{ marginRight: 8 }}>
                  streak ended
                </span>
                {formatDate(streak.endedBy.date)} —{" "}
                {won ? "lost to" : "beat"}{" "}
                <Link
                  className="player-link"
                  to={`/player/${encodeURIComponent(
                    won ? streak.endedBy.winnerName : streak.endedBy.loserName,
                  )}`}
                >
                  <PlayerName
                    name={won ? streak.endedBy.winnerName : streak.endedBy.loserName}
                  />
                </Link>
                {streak.endedBy.score ? ` ${streak.endedBy.score}` : ""}
              </>
            ) : (
              <span className={`badge ${won ? "up" : "down"}`}>streak still active</span>
            )}
          </div>
        </div>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
