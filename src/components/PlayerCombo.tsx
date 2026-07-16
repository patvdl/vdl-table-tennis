import { useState } from "react";
import { useMatches } from "../store/matches";
import PlayerName from "./PlayerName";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Player picker: click for the full list, type to filter, Tab to autocomplete
 * when the typed letters match exactly one player. Typing a brand-new name
 * is allowed (that's how new players get created).
 */
export default function PlayerCombo({ value, onChange, placeholder }: Props) {
  const { playerNames } = useMatches();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);

  const typed = value.trim().toLowerCase();
  const options = typed
    ? playerNames.filter((n) => n.toLowerCase().startsWith(typed))
    : playerNames;

  const select = (n: string) => {
    onChange(n);
    setOpen(false);
    setHi(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      // Autocomplete when the letters so far pin down exactly one player
      if (typed && options.length === 1 && options[0] !== value) {
        onChange(options[0]);
      }
      setOpen(false);
      setHi(-1);
      return; // let focus move on as normal
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && hi >= 0 && hi < options.length) {
        e.preventDefault();
        select(options[hi]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHi(-1);
    }
  };

  return (
    <div className="combo">
      <input
        value={value}
        placeholder={placeholder ?? "Select or type a name…"}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setHi(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {open && options.length > 0 && (
        <div className="combo-list">
          {options.map((n, i) => (
            <button
              key={n}
              type="button"
              className={`combo-item${i === hi ? " active" : ""}`}
              // mousedown (not click) so it fires before the input's blur
              onMouseDown={(e) => {
                e.preventDefault();
                select(n);
              }}
              onMouseEnter={() => setHi(i)}
            >
              <PlayerName name={n} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
