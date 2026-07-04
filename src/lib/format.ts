const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function round0(n: number): string {
  return String(Math.round(n));
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return n >= 0 ? `+${v}` : v;
}
