import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMatches } from "../store/matches";
import { headToHead, RATED_MIN, START_RATING } from "../lib/elo";
import { playerStreaks, bestCareerWin } from "../lib/records";
import type { StreakRecord } from "../lib/records";
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

  const streaks = useMemo(
    () => playerStreaks(replayResult.enriched, player),
    [player, replayResult],
  );
  const bestWin = useMemo(
    () => bestCareerWin(replayResult.enriched, player),
    [player, replayResult],
  );

  // Oldest first, for the form chart
  const chronological = useMemo(
    () => replayResult.enriched.filter((m) => m.player1 === player || m.player2 === player),
    [player, replayResult],
  );
  const myMatches = useMemo(() => [...chronological].reverse(), [chronological]); // newest first

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
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16, flexWrap: "wrap" }}>
          <Avatar player={player} size={240} />
          <div>
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
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="label">Rating</div>
            {isRated ? (
              <div className="value">{round0(stats.rating)}</div>
            ) : (
              <>
                <div className="value">—</div>
                <div className="hint">
                  ranked after {RATED_MIN - stats.played} more{" "}
                  {RATED_MIN - stats.played === 1 ? "match" : "matches"}
                </div>
              </>
            )}
          </div>
          <div className="stat-tile">
            <div className="label">Peak rating</div>
            {isRated ? (
              <>
                <div className="value">{round0(stats.peakRating)}</div>
                <div className="hint">
                  {stats.peakRating > START_RATING
                    ? `reached ${formatDate(stats.peakDate)}`
                    : `at start rating · since ${formatDate(stats.peakDate)}`}
                </div>
              </>
            ) : (
              <>
                <div className="value">—</div>
                <div className="hint">unrated</div>
              </>
            )}
          </div>
          <div className="stat-tile">
            <div className="label">Record</div>
            <div className="value">
              <span style={{ color: "var(--green)" }}>{stats.wins}</span>–
              <span style={{ color: "var(--red)" }}>{stats.losses}</span>
            </div>
            <div className="hint">{pct(stats.wins / Math.max(stats.played, 1))} win rate</div>
          </div>
          <div className="stat-tile">
            <div className="label">Best win</div>
            {bestWin ? (
              <>
                <div className="value">#{bestWin.opponentRank}</div>
                <div className="hint">
                  beat <PlayerName name={bestWin.match.loserName} /> ·{" "}
                  {formatDate(bestWin.match.date)}
                  {bestWin.match.score ? ` · ${bestWin.match.score}` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="value">—</div>
                <div className="hint">no wins over ranked players yet</div>
              </>
            )}
          </div>
          <div className="stat-tile">
            <div className="label">Career-high rank</div>
            {stats.bestRankDate ? (
              <>
                <div className="value">#{stats.bestRank}</div>
                <div className="hint">reached {formatDate(stats.bestRankDate)}</div>
              </>
            ) : (
              <>
                <div className="value">—</div>
                <div className="hint">not ranked yet</div>
              </>
            )}
          </div>
          <div className="stat-tile">
            <div className="label">Current streak</div>
            <div className="value">
              <StreakBadge streak={stats.streak} />
            </div>
          </div>
          <div className="stat-tile">
            <div className="label">Best win streak</div>
            <div className="value">
              {streaks.bestWin ? `W${streaks.bestWin.length}` : "—"}
            </div>
            <div className="hint">
              {streaks.bestWin
                ? `started ${formatDate(streaks.bestWin.start)} · ${
                    streaks.bestWin.end
                      ? `lost ${formatDate(streaks.bestWin.end)}`
                      : "still active"
                  }`
                : "no wins yet"}
            </div>
            {streaks.bestWin && (
              <button
                className="btn ghost"
                style={{ padding: "3px 12px", fontSize: 11, marginTop: 8 }}
                onClick={() => setStreakModal("win")}
              >
                Details
              </button>
            )}
          </div>
          <div className="stat-tile">
            <div className="label">Worst losing streak</div>
            <div className="value">
              {streaks.worstLoss ? `L${streaks.worstLoss.length}` : "—"}
            </div>
            <div className="hint">
              {streaks.worstLoss
                ? `started ${formatDate(streaks.worstLoss.start)} · ${
                    streaks.worstLoss.end
                      ? `won ${formatDate(streaks.worstLoss.end)}`
                      : "still active"
                  }`
                : "no losses yet"}
            </div>
            {streaks.worstLoss && (
              <button
                className="btn ghost"
                style={{ padding: "3px 12px", fontSize: 11, marginTop: 8 }}
                onClick={() => setStreakModal("loss")}
              >
                Details
              </button>
            )}
          </div>
          <div className="stat-tile">
            <div className="label">Last played</div>
            <div className="value" style={{ fontSize: 15 }}>
              {formatDate(stats.lastPlayed)}
            </div>
          </div>
          {titles.length > 0 && (
            <div className="stat-tile">
              <div className="label">Tournament titles</div>
              <div className="value">{titles.length}</div>
              <div className="hint">{titles.map((t) => t.name).join(" · ")}</div>
            </div>
          )}
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
        <div className="table-wrap">
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
    </>
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
