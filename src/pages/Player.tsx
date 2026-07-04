import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMatches } from "../store/matches";
import { headToHead } from "../lib/elo";
import { formatDate, round0, pct, signed } from "../lib/format";
import Sparkline from "../components/Sparkline";
import StreakBadge from "../components/StreakBadge";

export default function PlayerPage() {
  const { name = "" } = useParams();
  const player = decodeURIComponent(name);
  const { board, replayResult } = useMatches();

  const stats = replayResult.stats.get(player);
  const rank = board.findIndex((p) => p.name === player) + 1;

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
    return (
      <div className="card">
        <h2>{player}</h2>
        <p className="sub">No matches found for this player.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>
          {player}{" "}
          <span className={`badge ${rank === 1 ? "gold" : "neutral"}`}>#{rank}</span>
        </h2>
        <p className="sub">Full career profile</p>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="label">Rating</div>
            <div className="value">{round0(stats.rating)}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Peak rating</div>
            <div className="value">{round0(stats.peakRating)}</div>
            <div className="hint">
              {stats.peakDate ? `reached ${formatDate(stats.peakDate)}` : "at start rating"}
            </div>
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
            <div className="label">Career-high rank</div>
            <div className="value">#{stats.bestRank}</div>
            <div className="hint">reached {formatDate(stats.bestRankDate)}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Current streak</div>
            <div className="value">
              <StreakBadge streak={stats.streak} />
            </div>
          </div>
          <div className="stat-tile">
            <div className="label">Best win streak</div>
            <div className="value">W{stats.bestStreak}</div>
            <div className="hint">
              {stats.bestStreak === 0
                ? "no wins yet"
                : `started ${formatDate(stats.bestStreakStart)} · ${
                    stats.bestStreakEnd
                      ? `lost ${formatDate(stats.bestStreakEnd)}`
                      : "still active"
                  }`}
            </div>
          </div>
          <div className="stat-tile">
            <div className="label">Last played</div>
            <div className="value" style={{ fontSize: 15 }}>
              {formatDate(stats.lastPlayed)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <label className="field">Rating over time ({stats.played} matches)</label>
          <Sparkline values={stats.history} width={640} height={80} />
        </div>
      </div>

      <div className="card">
        <h2>Rivalries</h2>
        <p className="sub">Head-to-head record against every opponent.</p>
        <div className="table-wrap">
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
                      {h.b}
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
    </>
  );
}
