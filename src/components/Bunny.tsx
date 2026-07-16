/** A little black lop-eared bunny — Emily's mascot */
export default function Bunny({ size = 26 }: { size?: number | string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="black lop-eared bunny"
      style={{ verticalAlign: "-0.18em", marginLeft: 3 }}
    >
      <g stroke="#8a8a94" strokeWidth="1.5" fill="#101013">
        {/* lop ears hanging down beside the head */}
        <ellipse cx="15" cy="32" rx="6.5" ry="15" transform="rotate(10 15 32)" />
        <ellipse cx="49" cy="32" rx="6.5" ry="15" transform="rotate(-10 49 32)" />
        {/* body */}
        <ellipse cx="32" cy="51" rx="15" ry="10" />
        {/* head */}
        <circle cx="32" cy="27" r="15" />
      </g>
      {/* eyes */}
      <circle cx="26.5" cy="25" r="2" fill="#e9e9ef" />
      <circle cx="37.5" cy="25" r="2" fill="#e9e9ef" />
      {/* pink nose */}
      <circle cx="32" cy="31" r="1.8" fill="#e8a2b6" />
      {/* whisker hints */}
      <g stroke="#8a8a94" strokeWidth="1" strokeLinecap="round">
        <line x1="24" y1="31" x2="19" y2="30" />
        <line x1="24" y1="33" x2="19" y2="34" />
        <line x1="40" y1="31" x2="45" y2="30" />
        <line x1="40" y1="33" x2="45" y2="34" />
      </g>
    </svg>
  );
}
