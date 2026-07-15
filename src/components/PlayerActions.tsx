import { useRef, useState } from "react";
import { useMatches } from "../store/matches";
import { useAuth } from "../store/auth";
import { TRASH_DAYS } from "../store/store";
import { fileToAvatar } from "../lib/image";
import Avatar from "./Avatar";

interface Props {
  player: string;
  /** Called after a successful rename (e.g. to move to the new profile URL) */
  onRenamed?: (newName: string) => void;
  /** Called after the player is deleted */
  onDeleted?: () => void;
}

/** Admin-only ⋯ menu with "Edit player" (name + photo) and "Delete player". */
export default function PlayerActions({ player, onRenamed, onDeleted }: Props) {
  const { role } = useAuth();
  const { playerNames, matches, avatars, setPlayerAvatar, renamePlayer, removePlayer } =
    useMatches();

  const btnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState<React.CSSProperties | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role !== "admin") return null;

  const openMenu = () => {
    const r = btnRef.current!.getBoundingClientRect();
    const pos: React.CSSProperties = { right: Math.max(8, window.innerWidth - r.right) };
    // Flip upward when the row sits near the bottom of the viewport
    if (window.innerHeight - r.bottom < 110) pos.bottom = window.innerHeight - r.top + 4;
    else pos.top = r.bottom + 4;
    setMenuPos(pos);
  };

  const startEdit = () => {
    setMenuPos(null);
    setName(player);
    setError(null);
    setEditing(true);
  };

  const doDelete = async () => {
    setMenuPos(null);
    const count = matches.filter((m) => m.player1 === player || m.player2 === player).length;
    const warning =
      count > 0
        ? `Are you sure you want to delete ${player}?\n\nThis removes them and all ${count} of their ${count === 1 ? "match" : "matches"}. Everyone's ratings are recalculated as if those matches never happened.\n\nIf this is a mistake, an admin can restore them from the leaderboard's "Recently deleted" section for ${TRASH_DAYS} days. After that, the data is gone for good.`
        : `Are you sure you want to delete ${player}?\n\nThey have no matches yet, so nothing else is affected and there is nothing to restore later.`;
    if (!confirm(warning)) return;
    setBusy(true);
    try {
      await removePlayer(player);
      onDeleted?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await setPlayerAvatar(player, await fileToAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    setError(null);
    try {
      await setPlayerAvatar(player, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    const newName = name.trim();
    if (!newName || newName === player) {
      setEditing(false);
      return;
    }
    if (playerNames.some((n) => n !== player && n.toLowerCase() === newName.toLowerCase())) {
      setError(`"${newName}" already exists.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renamePlayer(player, newName);
      setEditing(false);
      onRenamed?.(newName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        className="menu-btn"
        title={`Manage ${player}`}
        aria-label={`Manage ${player}`}
        onClick={() => (menuPos ? setMenuPos(null) : openMenu())}
      >
        ⋯
      </button>

      {menuPos && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuPos(null)} />
          <div className="menu" style={menuPos}>
            <button className="menu-item" onClick={startEdit}>
              Edit player
            </button>
            <button className="menu-item danger" onClick={doDelete}>
              Delete player
            </button>
          </div>
        </>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => !busy && setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Edit player</h2>

            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "14px 0" }}>
              <Avatar player={player} size={72} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn ghost"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {avatars.has(player) ? "Change photo" : "Add photo"}
                </button>
                {avatars.has(player) && (
                  <button
                    className="btn danger"
                    style={{ padding: "6px 14px", fontSize: 13 }}
                    disabled={busy}
                    onClick={removePhoto}
                  >
                    Remove photo
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={pickPhoto}
                />
              </div>
            </div>

            <label className="field">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
            />
            {error && (
              <p className="sub" style={{ margin: "8px 0 0", color: "var(--red)" }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn" disabled={busy} onClick={saveName}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
