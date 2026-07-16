/** Minimal flat gold crown — marks the top-ranked player / season leader */
export default function Crown({
  size = "1em",
  title = "Top ranked",
}: {
  size?: number | string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      style={{ verticalAlign: "-0.12em", marginLeft: 4 }}
    >
      <path
        d="M4 16.2 L5.2 8.6 L9.3 11.9 L12 6.2 L14.7 11.9 L18.8 8.6 L20 16.2 Z"
        fill="#e8b53a"
        stroke="#e8b53a"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="4.3" y="17.6" width="15.4" height="2" rx="1" fill="#e8b53a" />
    </svg>
  );
}
