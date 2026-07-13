import { signed } from "../lib/format";

/** A rating change, green when positive, red when negative, dim when zero. */
export default function Delta({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span style={{ color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: 13 }}>
        0.0
      </span>
    );
  }
  return <span className={value > 0 ? "delta-up" : "delta-down"}>{signed(value)}</span>;
}
