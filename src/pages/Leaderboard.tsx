import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMatches } from "../store/matches";
import { useAuth } from "../store/auth";
import { TRASH_DAYS } from "../store/store";
import { RATED_MIN, replay, leaderboard, unratedPlayers } from "../lib/elo";
import { formatDate, round0, pct } from "../lib/format";
import type { PlayerStats } from "../types";
import Sparkline from "../components/Sparkline";
import StreakBadge from "../components/StreakBadge";
import Trophy from "../components/Trophy";
import PlayerActions from "../components/PlayerActions";
import PlayerName from "../components/PlayerName";
import Crowns from "../components/Crowns";

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type SortKey =
  | "name"
  | "rating"
  | "peak"
  | "played"
  | "wins"
  | "losses"
  | "winpct"
  | "streak"
  | "last";

const DEFAULT_DIR: Record<SortKey, 1 | -1> = {
  name: 1, // alphabetical
  rating: -1,
  peak: -1,
  played: -1,
  wins: -1,
  losses: -1,
  winpct: -1,
  streak: -1,
  last: -1, // most recent first
};

function sortValue(p: PlayerStats, key: SortKey): string | number {
  switch (key) {
    case "name":
      return p.name.toLowerCase();
    case "rating":
      return p.rating;
    case "peak":
      return p.peakRating;
    case "played":
      return p.played;
    case "wins":
      return p.wins;
    case "losses":
      return p.losses;
    case "winpct":
      return p.played ? p.wins / p.played : -1;
    case "streak":
      return p.streak;
    case "last":
      return p.lastPlayed ?? "";
  }
}

export default function Leaderboard() {
  const {
    board,
    unratedBoard,
    matches,
    playerNames,
    replayResult,
    addPlayer,
    trash,
    restorePlayer,
    purgeDeletedPlayer,
  } = useMatches();
  const { role } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [asOf, setAsOf] = useState(""); // "" = today (live board)
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [trashBusy, setTrashBusy] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const onRestore = async (name: string) => {
    setTrashBusy(name);
    try {
      await restorePlayer(name);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setTrashBusy(null);
    }
  };

  const onPurge = async (name: string, matchCount: number) => {
    if (
      !confirm(
        `Permanently delete ${name} and their ${matchCount} ${matchCount === 1 ? "match" : "matches"} right now?\n\nThis cannot be undone.`,
      )
    )
      return;
    setTrashBusy(name);
    try {
      await purgeDeletedPlayer(name);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setTrashBusy(null);
    }
  };

  // Registered players who haven't played a match yet
  const pendingPlayers = useMemo(
    () => playerNames.filter((n) => !replayResult.stats.has(n)),
    [playerNames, replayResult],
  );

  const submitPlayer = async (e: FormEvent) => {
    e.preventDefault();
    const name = newPlayer.trim();
    setAddMsg(null);
    if (!name) return;
    if (playerNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setAddMsg({ kind: "err", text: `"${name}" already exists.` });
      return;
    }
    setAddBusy(true);
    try {
      await addPlayer(name);
      setNewPlayer("");
      setShowAddPlayer(false);
      setAddMsg({ kind: "ok", text: `${name} added — they'll show under unrated players until they've played ${RATED_MIN} matches.` });
    } catch (err) {
      setAddMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setAddBusy(false);
    }
  };

  const today = todayISO();
  const firstDate = useMemo(
    () => matches.reduce((min, m) => (m.date < min ? m.date : min), today),
    [matches, today],
  );

  // Time machine: replay only the matches played on/before the chosen date
  const view = useMemo(() => {
    if (!asOf || asOf >= today)
      return { board, unratedBoard, matchCount: matches.length };
    const subset = matches.filter((m) => m.date <= asOf);
    const rr = replay(subset);
    return {
      board: leaderboard(rr.stats),
      unratedBoard: unratedPlayers(rr.stats),
      matchCount: subset.length,
    };
  }, [asOf, today, matches, board, unratedBoard]);

  const timeTravelling = Boolean(asOf) && asOf < today;

  // Rank is always rating-based, regardless of the active sort
  const ratingRank = useMemo(() => {
    const m = new Map<string, number>();
    view.board.forEach((p, i) => m.set(p.name, i + 1));
    return m;
  }, [view.board]);

  const sorted = useMemo(() => {
    const arr = [...view.board];
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : va - (vb as number);
      // stable tie-break on rating so equal values keep a sensible order
      return dir * cmp || b.rating - a.rating;
    });
    return arr;
  }, [view.board, sortKey, dir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setDir(DEFAULT_DIR[key]);
    }
  };

  const Th = ({
    k,
    label,
    numeric,
  }: {
    k: SortKey;
    label: string;
    numeric?: boolean;
  }) => (
    <th
      className={`sortable${numeric ? " num" : ""}${sortKey === k ? " sorted" : ""}`}
      onClick={() => onSort(k)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <span className="sort-arrow">
        {sortKey === k ? (dir === -1 ? "▼" : "▲") : ""}
      </span>
    </th>
  );

  return (
    <>
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2>Leaderboard</h2>
          <p className="sub">
            {timeTravelling
              ? `The rankings as they stood on ${formatDate(asOf)} · ${view.matchCount} matches played by then`
              : `${view.board.length} ranked players · ${view.matchCount} matches recorded · click a column to sort`}
          </p>
        </div>
        {role === "admin" && (
          <button className="btn ghost" onClick={() => { setShowAddPlayer((s) => !s); setAddMsg(null); }}>
            {showAddPlayer ? "Cancel" : "+ Add player"}
          </button>
        )}
      </div>

      {addMsg && <div className={`notice ${addMsg.kind}`}>{addMsg.text}</div>}

      {showAddPlayer && (
        <form onSubmit={submitPlayer} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input
            style={{ maxWidth: 240 }}
            placeholder="New player name"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            autoFocus
          />
          <button className="btn" type="submit" disabled={addBusy || !newPlayer.trim()}>
            {addBusy ? "Adding…" : "Add player"}
          </button>
        </form>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ maxWidth: 220 }}>
          <label className="field">View rankings on date</label>
          <input
            type="date"
            value={asOf || today}
            min={firstDate}
            max={today}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </div>
        {timeTravelling && (
          <button className="btn ghost" onClick={() => setAsOf("")}>
            Back to today
          </button>
        )}
      </div>

      {view.board.length === 0 ? (
        <p className="sub" style={{ margin: 0 }}>
          No ranked players yet on this date — nobody had played {RATED_MIN} matches.
        </p>
      ) : (
      <div className="table-wrap pin-2">
        <table>
          <thead>
            <tr>
              <th className="rank-cell">#</th>
              <Th k="name" label="Player" />
              <Th k="rating" label="Rating" numeric />
              <Th k="peak" label="Peak" numeric />
              <Th k="played" label="Played" numeric />
              <Th k="wins" label="W" numeric />
              <Th k="losses" label="L" numeric />
              <Th k="winpct" label="Win %" numeric />
              <Th k="streak" label="Streak" />
              <th>Form</th>
              <Th k="last" label="Last played" />
              {role === "admin" && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const rank = ratingRank.get(p.name)!;
              return (
                <tr key={p.name}>
                  <td className={`rank-cell rank-${rank}`}>{rank}</td>
                  <td>
                    <Link
                      className="player-link"
                      to={`/player/${encodeURIComponent(p.name)}`}
                    >
                      <PlayerName name={p.name} />
                    </Link>
                    <Crowns player={p.name} asOf={timeTravelling ? asOf : undefined} />
                    <Trophy player={p.name} asOf={timeTravelling ? asOf : undefined} />
                  </td>
                  <td className="num rating">{round0(p.rating)}</td>
                  <td className="num" style={{ color: "var(--text-dim)" }}>
                    {round0(p.peakRating)}
                  </td>
                  <td className="num">{p.played}</td>
                  <td className="num" style={{ color: "var(--green)" }}>
                    {p.wins}
                  </td>
                  <td className="num" style={{ color: "var(--red)" }}>
                    {p.losses}
                  </td>
                  <td className="num">{p.played ? pct(p.wins / p.played) : "—"}</td>
                  <td>
                    <StreakBadge streak={p.streak} />
                  </td>
                  <td>
                    <Sparkline values={p.history.slice(-20)} />
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {formatDate(p.lastPlayed)}
                  </td>
                  {role === "admin" && (
                    <td className="actions-cell">
                      <PlayerActions player={p.name} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>

    {(view.unratedBoard.length > 0 || pendingPlayers.length > 0) && (
      <div className="card">
        <h2>Unrated players</h2>
        <p className="sub">
          Everyone joins the rankings after {RATED_MIN} matches. Results here are
          recorded (and count in head-to-heads), but don't earn a rating yet.
        </p>
        <div className="table-wrap pin-1">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th className="num">Played</th>
                <th className="num">W</th>
                <th className="num">L</th>
                <th className="num">Win %</th>
                <th>Until ranked</th>
                <th>Last played</th>
                {role === "admin" && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {view.unratedBoard.map((p) => (
                <tr key={p.name}>
                  <td>
                    <Link
                      className="player-link"
                      to={`/player/${encodeURIComponent(p.name)}`}
                    >
                      <PlayerName name={p.name} />
                    </Link>
                    <Crowns player={p.name} asOf={timeTravelling ? asOf : undefined} />
                    <Trophy player={p.name} asOf={timeTravelling ? asOf : undefined} />
                  </td>
                  <td className="num">{p.played}</td>
                  <td className="num" style={{ color: "var(--green)" }}>
                    {p.wins}
                  </td>
                  <td className="num" style={{ color: "var(--red)" }}>
                    {p.losses}
                  </td>
                  <td className="num">{p.played ? pct(p.wins / p.played) : "—"}</td>
                  <td>
                    <span className="badge neutral">
                      {RATED_MIN - p.played} more {RATED_MIN - p.played === 1 ? "match" : "matches"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {formatDate(p.lastPlayed)}
                  </td>
                  {role === "admin" && (
                    <td className="actions-cell">
                      <PlayerActions player={p.name} />
                    </td>
                  )}
                </tr>
              ))}
              {pendingPlayers.map((n) => (
                <tr key={n}>
                  <td>
                    <Link
                      className="player-link"
                      to={`/player/${encodeURIComponent(n)}`}
                    >
                      <PlayerName name={n} />
                    </Link>
                    <Crowns player={n} />
                    <Trophy player={n} />
                  </td>
                  <td className="num">0</td>
                  <td className="num" style={{ color: "var(--green)" }}>0</td>
                  <td className="num" style={{ color: "var(--red)" }}>0</td>
                  <td className="num">—</td>
                  <td>
                    <span className="badge neutral">{RATED_MIN} more matches</span>
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>—</td>
                  {role === "admin" && (
                    <td className="actions-cell">
                      <PlayerActions player={n} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {role === "admin" && trash.length > 0 && !showTrash && (
      <div style={{ textAlign: "center", marginTop: 2 }}>
        <button
          onClick={() => setShowTrash(true)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            fontSize: 12,
            cursor: "pointer",
            padding: "6px 10px",
            opacity: 0.7,
          }}
        >
          Recently deleted ({trash.length})
        </button>
      </div>
    )}

    {role === "admin" && trash.length > 0 && showTrash && (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h2>Recently deleted</h2>
          <button
            className="btn ghost"
            style={{ padding: "4px 12px", fontSize: 12 }}
            onClick={() => setShowTrash(false)}
          >
            Hide
          </button>
        </div>
        <p className="sub">
          Deleted players can be restored for {TRASH_DAYS} days — matches, ratings and
          photo come back exactly as they were. After that, the data is removed permanently.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th className="num">Matches</th>
                <th>Deleted</th>
                <th>Time left</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {trash.map((t) => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (Date.parse(t.deletedAt) + TRASH_DAYS * 86400000 - Date.now()) /
                      86400000,
                  ),
                );
                const busy = trashBusy === t.name;
                return (
                  <tr key={t.name}>
                    <td>
                      <PlayerName name={t.name} />
                    </td>
                    <td className="num">{t.matchCount}</td>
                    <td style={{ color: "var(--text-dim)" }}>
                      {formatDate(t.deletedAt.slice(0, 10))}
                    </td>
                    <td>
                      <span className={`badge ${daysLeft <= 5 ? "down" : "neutral"}`}>
                        {daysLeft} {daysLeft === 1 ? "day" : "days"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 12px", fontSize: 12, marginRight: 8 }}
                        disabled={busy}
                        onClick={() => onRestore(t.name)}
                      >
                        {busy ? "…" : "Restore"}
                      </button>
                      <button
                        className="btn danger"
                        disabled={busy}
                        onClick={() => onPurge(t.name, t.matchCount)}
                      >
                        Delete now
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
    </>
  );
}
