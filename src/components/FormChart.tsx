import type { EnrichedMatch } from "../types";
import { formatDate } from "../lib/format";

interface Props {
  /** The player's matches, oldest first */
  matches: EnrichedMatch[];
  player: string;
}

const W = 720;
const H = 200;
const PAD = { top: 24, right: 14, bottom: 24, left: 14 };

/**
 * Career form graph: the running wins-minus-losses tally after every match.
 * Above the dashed zero line the player holds a winning record, below it a
 * losing one. Each dot is one match, coloured by the result.
 */
export default function FormChart({ matches, player }: Props) {
  if (matches.length === 0) return null;

  // +1 for every win, -1 for every loss, starting level at 0
  const diffs: number[] = [0];
  const running: { wins: number; losses: number }[] = [];
  let wins = 0;
  let losses = 0;
  for (const m of matches) {
    if (m.winnerName === player) wins++;
    else losses++;
    running.push({ wins, losses });
    diffs.push(wins - losses);
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMax = Math.max(0, ...diffs);
  const yMin = Math.min(0, ...diffs);
  const span = yMax - yMin || 1;

  const x = (i: number) => PAD.left + (i / (diffs.length - 1)) * innerW;
  const y = (v: number) => PAD.top + ((yMax - v) / span) * innerH;

  const linePts = diffs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const areaPts = `${linePts} ${x(diffs.length - 1).toFixed(1)},${zeroY.toFixed(1)} ${x(0).toFixed(1)},${zeroY.toFixed(1)}`;

  const dotR =
    matches.length > 160 ? 1.7 : matches.length > 80 ? 2.2 : matches.length > 40 ? 2.8 : 3.5;
  const maxIdx = diffs.indexOf(yMax);
  const minIdx = diffs.indexOf(yMin);
  const clampX = (v: number) => Math.min(Math.max(v, PAD.left + 12), W - PAD.right - 12);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block" }}
        role="img"
        aria-label={`Career form graph for ${player}`}
      >
        <defs>
          <clipPath id="form-above">
            <rect x="0" y="0" width={W} height={zeroY} />
          </clipPath>
          <clipPath id="form-below">
            <rect x="0" y={zeroY} width={W} height={H - zeroY} />
          </clipPath>
        </defs>

        {yMax > 0 && (
          <polygon points={areaPts} fill="var(--green)" opacity="0.13" clipPath="url(#form-above)" />
        )}
        {yMin < 0 && (
          <polygon points={areaPts} fill="var(--red)" opacity="0.13" clipPath="url(#form-below)" />
        )}

        <line
          x1={PAD.left}
          y1={zeroY}
          x2={W - PAD.right}
          y2={zeroY}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />

        <polyline
          points={linePts}
          fill="none"
          stroke="var(--text)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.85"
        />

        {matches.map((m, i) => {
          const won = m.winnerName === player;
          const opponent = m.player1 === player ? m.player2 : m.player1;
          return (
            <circle
              key={m.id}
              cx={x(i + 1)}
              cy={y(diffs[i + 1])}
              r={dotR}
              fill={won ? "var(--green)" : "var(--red)"}
            >
              <title>
                {`${formatDate(m.date)} — ${won ? "beat" : "lost to"} ${opponent}${m.score ? ` (${m.score})` : ""} · record ${running[i].wins}–${running[i].losses}`}
              </title>
            </circle>
          );
        })}

        {yMax > 0 && (
          <text x={PAD.left} y={14} fill="var(--green)" fontSize="11" fontWeight="700">
            ▲ winning record
          </text>
        )}
        {yMin < 0 && (
          <text x={PAD.left} y={H - 6} fill="var(--red)" fontSize="11" fontWeight="700">
            ▼ losing record
          </text>
        )}

        {yMax > 0 && (
          <text
            x={clampX(x(maxIdx))}
            y={Math.max(y(yMax) - 8, 12)}
            fill="var(--text-dim)"
            fontSize="10"
            fontFamily="var(--mono)"
            textAnchor="middle"
          >
            +{yMax}
          </text>
        )}
        {yMin < 0 && (
          <text
            x={clampX(x(minIdx))}
            y={Math.min(y(yMin) + 16, H - 4)}
            fill="var(--text-dim)"
            fontSize="10"
            fontFamily="var(--mono)"
            textAnchor="middle"
          >
            {yMin}
          </text>
        )}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-dim)",
          marginTop: 4,
        }}
      >
        <span>{formatDate(matches[0].date)} · first match</span>
        <span>{formatDate(matches[matches.length - 1].date)} · latest</span>
      </div>
    </div>
  );
}
