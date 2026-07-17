interface Props {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  /** Stretch to the container's width (keeps aspect ratio) — for phone screens */
  fluid?: boolean;
}

export default function Sparkline({
  values,
  width = 110,
  height = 28,
  stroke = "var(--accent)",
  fluid = false,
}: Props) {
  if (values.length < 2) return <span style={{ color: "var(--text-dim)" }}>—</span>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;

  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="spark"
      width={fluid ? "100%" : width}
      height={fluid ? undefined : height}
      viewBox={`0 0 ${width} ${height}`}
      style={fluid ? { maxWidth: width } : undefined}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
