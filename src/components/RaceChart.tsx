import { useMemo, useState } from "react";
import type { Match } from "../types";
import { replay } from "../lib/elo";
import { formatDate } from "../lib/format";

/** Distinct line colours, assigned by leaderboard position */
const COLORS = [
  "#fb923c",
  "#60a5fa",
  "#4ade80",
  "#f87171",
  "#c084fc",
  "#fbbf24",
  "#2dd4bf",
  "#f472b6",
  "#a3e635",
  "#94a3b8",
];

const W = 860;
const BASE_H = 330;
const PAD = { top: 18, right: 96, bottom: 30, left: 48 };
const DEFAULT_SHOWN = 5;
const LABEL_GAP = 17;

interface Props {
  /** Full match log (any order) */
  matches: Match[];
  /** Rated players in leaderboard order — sets colours and the default pick */
  players: string[];
}

/**
 * The rating race: every selected player's rating over real time on one
 * shared axis, so the lead changes and crossovers are visible. Ratings
 * carry flat through quiet spells (they don't decay), so a line only
 * moves when that player plays.
 */
export default function RaceChart({ matches, players }: Props) {
  // null = untouched: default to the current top 5 (follows date changes)
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = picked ?? players.slice(0, DEFAULT_SHOWN);

  const toggle = (name: string) =>
    setPicked(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name],
    );

  const allOn = players.length > 0 && players.every((p) => selected.includes(p));
  const toggleAll = () => setPicked(allOn ? [] : players);

  // Rating at the end of every match date, per player, carried forward.
  // The x-axis is real time, so the replay runs in date order here — a
  // backdated match that hasn't been re-sequenced yet would otherwise
  // drag its end-of-log rating back in time and draw a spike.
  const seriesByPlayer = useMemo(() => {
    const dateOrdered = [...matches]
      .sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq)
      .map((m, i) => ({ ...m, seq: i + 1 }));
    const ordered = replay(dateOrdered).enriched;
    const dates = [...new Set(ordered.map((m) => m.date))].sort();
    const byDate = new Map<string, typeof ordered>();
    for (const m of ordered) {
      const list = byDate.get(m.date);
      if (list) list.push(m);
      else byDate.set(m.date, [m]);
    }
    const current = new Map<string, number>();
    const series = new Map<string, { t: number; r: number }[]>();
    for (const d of dates) {
      for (const m of byDate.get(d)!) {
        current.set(m.player1, m.rating1After);
        current.set(m.player2, m.rating2After);
      }
      const t = Date.parse(d);
      for (const [p, r] of current) {
        let s = series.get(p);
        if (!s) series.set(p, (s = []));
        s.push({ t, r });
      }
    }
    return series;
  }, [matches]);

  const shown = useMemo(
    () =>
      players
        .map((p, i) => ({
          player: p,
          color: COLORS[i % COLORS.length],
          points: seriesByPlayer.get(p) ?? [],
        }))
        .filter((s) => selected.includes(s.player) && s.points.length > 1),
    [players, seriesByPlayer, selected],
  );

  if (players.length === 0) return null;

  // Grow the chart so every end label gets its own row — with the whole
  // family selected the names stack, so give them the room they need.
  const H = Math.max(
    BASE_H,
    PAD.top + PAD.bottom + shown.length * LABEL_GAP + 12,
  );

  let t0 = Infinity;
  let t1 = -Infinity;
  let rMin = Infinity;
  let rMax = -Infinity;
  for (const s of shown) {
    for (const p of s.points) {
      if (p.t < t0) t0 = p.t;
      if (p.t > t1) t1 = p.t;
      if (p.r < rMin) rMin = p.r;
      if (p.r > rMax) rMax = p.r;
    }
  }
  const hasData = shown.length > 0 && t1 > t0;
  if (!hasData) {
    rMin = 950;
    rMax = 1050;
    t0 = 0;
    t1 = 1;
  }
  const yPad = (rMax - rMin) * 0.06 + 4;
  rMin -= yPad;
  rMax += yPad;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW;
  const y = (r: number) => PAD.top + ((rMax - r) / (rMax - rMin)) * innerH;

  const range = rMax - rMin;
  const step =
    [10, 20, 25, 50, 100, 200, 400].find((s) => range / s <= 6) ?? 400;
  const ticks: number[] = [];
  for (let v = Math.ceil(rMin / step) * step; v <= rMax; v += step) ticks.push(v);

  // End-of-line name labels, nudged apart so they never overlap
  const labels = shown
    .map((s) => ({
      name: s.player,
      color: s.color,
      y: y(s.points[s.points.length - 1].r),
    }))
    .sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const l of labels) {
    l.y = Math.max(l.y, prev + LABEL_GAP);
    prev = l.y;
  }
  // If the stack ran past the bottom edge, squeeze it back up from the
  // bottom. The chart height is sized so every label fits, so this can
  // never push the top label off the chart.
  let cap = H - PAD.bottom;
  for (let i = labels.length - 1; i >= 0; i--) {
    labels[i].y = Math.min(labels[i].y, cap);
    cap = labels[i].y - LABEL_GAP;
  }

  const midT = t0 + (t1 - t0) / 2;
  const dateLabel = (t: number) => formatDate(new Date(t).toISOString().slice(0, 10));

  return (
    <div>
      <div className="chip-row">
        <button
          type="button"
          className="chip on"
          style={{ borderColor: "var(--text-dim)" }}
          onClick={toggleAll}
        >
          {allOn ? "Deselect all" : "Select all"}
        </button>
        {players.map((p, i) => {
          const on = selected.includes(p);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={p}
              type="button"
              className={`chip ${on ? "on" : ""}`}
              style={on ? { borderColor: color } : undefined}
              onClick={() => toggle(p)}
            >
              <span
                className="chip-dot"
                style={{ background: on ? color : "var(--border)" }}
              />
              {p}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="sub" style={{ margin: "18px 0" }}>
          Pick at least one player above to draw the race.
        </p>
      ) : (
        <svg
          className="trend-chart"
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block" }}
          role="img"
          aria-label="Rating race chart"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={y(v)}
                x2={W - PAD.right}
                y2={y(v)}
                stroke="var(--border)"
                strokeDasharray="3 5"
                opacity="0.6"
              />
              <text
                x={PAD.left - 7}
                y={y(v) + 3.5}
                textAnchor="end"
                fill="var(--text-dim)"
                fontSize="11"
                fontFamily="var(--mono)"
              >
                {v}
              </text>
            </g>
          ))}

          {shown.map((s) => (
            <polyline
              key={s.player}
              points={s.points.map((p) => `${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              <title>{s.player}</title>
            </polyline>
          ))}

          {shown.map((s) => {
            const last = s.points[s.points.length - 1];
            return (
              <circle
                key={s.player}
                cx={x(last.t)}
                cy={y(last.r)}
                r="3.2"
                fill={s.color}
              >
                <title>{`${s.player} · ${Math.round(last.r)}`}</title>
              </circle>
            );
          })}

          {labels.map((l) => (
            <text
              key={l.name}
              x={W - PAD.right + 8}
              y={l.y + 3.5}
              fill={l.color}
              fontSize="11"
              fontWeight="700"
            >
              {l.name}
            </text>
          ))}

          <text x={PAD.left} y={H - 8} fill="var(--text-dim)" fontSize="11">
            {dateLabel(t0)}
          </text>
          <text
            x={PAD.left + innerW / 2}
            y={H - 8}
            fill="var(--text-dim)"
            fontSize="11"
            textAnchor="middle"
          >
            {dateLabel(midT)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            fill="var(--text-dim)"
            fontSize="11"
            textAnchor="end"
          >
            {dateLabel(t1)}
          </text>
        </svg>
      )}
    </div>
  );
}
