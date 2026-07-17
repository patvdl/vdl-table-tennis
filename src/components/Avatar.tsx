import { useMatches } from "../store/matches";

/** Stable hue per name so each placeholder gets its own colour. */
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/**
 * Player profile picture. Shows the uploaded photo when one exists,
 * otherwise a coloured circle with the player's initial.
 */
export default function Avatar({ player, size = 40 }: { player: string; size?: number }) {
  const { avatars } = useMatches();
  const src = avatars.get(player);

  // Big avatars shrink on narrow phone screens instead of overflowing
  const dim = size > 100 ? `min(${size}px, 30vw)` : `${size}px`;

  if (src) {
    return (
      <img
        className="avatar"
        src={src}
        alt={player}
        style={{ width: dim, height: dim }}
      />
    );
  }

  const hue = hueFor(player);
  return (
    <span
      className="avatar avatar-letter"
      aria-label={player}
      style={{
        width: dim,
        height: dim,
        fontSize: `calc(${dim} * 0.42)`,
        background: `hsl(${hue} 35% 26%)`,
        color: `hsl(${hue} 70% 78%)`,
      }}
    >
      {player.trim().charAt(0).toUpperCase()}
    </span>
  );
}
