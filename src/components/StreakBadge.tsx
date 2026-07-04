export default function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return <span className="badge neutral">—</span>;
  if (streak > 0) return <span className="badge up">W{streak}</span>;
  return <span className="badge down">L{-streak}</span>;
}
