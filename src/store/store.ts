import { supabase } from "../lib/supabase";
import type {
  DeletedPlayer,
  Match,
  PlayerProfile,
  SetRecordEntry,
  Tournament,
} from "../types";
import seedRaw from "../data/seed-matches.json";

export type StoreMode = "supabase" | "local";

const SEED_TOURNAMENTS: Tournament[] = [
  { id: "seed-t-1", name: "Christmas 2024", date: "2024-12-25", status: "completed", bracket: null },
  { id: "seed-t-2", name: "Christmas 2025", date: "2025-12-25", status: "completed", bracket: null },
];

export interface NewMatch {
  date: string;
  player1: string;
  player2: string;
  winner: 1 | 2;
  score: string | null;
  tournament: string | null;
}

export interface DataStore {
  mode: StoreMode;
  load(): Promise<Match[]>;
  add(m: NewMatch): Promise<void>;
  remove(id: string): Promise<void>;
  /**
   * Re-slot a match in the log: place it immediately after `afterId`
   * (null = the very start). Ratings replay in log order, so this is how a
   * forgotten match gets inserted where it was actually played.
   */
  moveMatch(id: string, afterId: string | null): Promise<void>;
  loadTournaments(): Promise<Tournament[]>;
  addTournament(name: string, date: string): Promise<void>;
  setTournamentStatus(id: string, status: Tournament["status"]): Promise<void>;
  setTournamentBracket(id: string, bracket: Tournament["bracket"]): Promise<void>;
  removeTournament(id: string): Promise<void>;
  loadPlayers(): Promise<PlayerProfile[]>;
  /** Set a player's profile photo (data URL); null removes it */
  setPlayerAvatar(name: string, avatar: string | null): Promise<void>;
  /** Register a brand-new player (no matches yet) */
  addPlayer(name: string): Promise<void>;
  /** Rename a player everywhere: matches, profile photo, tournament brackets */
  renamePlayer(oldName: string, newName: string): Promise<void>;
  /**
   * Delete a player and every match they played. If they had matches, the
   * data is kept in a trash store for TRASH_DAYS so it can be restored.
   */
  removePlayer(name: string): Promise<void>;
  /** Soft-deleted players still inside the restore window (expired ones are purged) */
  loadTrash(): Promise<DeletedPlayer[]>;
  /** Bring back a soft-deleted player with all their matches and photo */
  restorePlayer(name: string): Promise<void>;
  /** Permanently discard a soft-deleted player's data right now */
  purgeDeletedPlayer(name: string): Promise<void>;
  /** Admin-entered single-set scorelines for the "Longest set played" record */
  loadSets(): Promise<SetRecordEntry[]>;
  addSet(s: Omit<SetRecordEntry, "id">): Promise<void>;
  removeSet(id: string): Promise<void>;
}

/** How long deleted players can be restored before their data is gone for good */
export const TRASH_DAYS = 30;
const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;

type SeedRow = [string, string, string, number, (string | null)?, (string | null)?];

function seedMatches(): Match[] {
  return (seedRaw as SeedRow[]).map((row, i) => ({
    id: `seed-${i + 1}`,
    seq: i + 1,
    date: row[0],
    player1: row[1],
    player2: row[2],
    winner: row[3] === 1 ? 1 : 2,
    score: row[4] ?? null,
    tournament: row[5] ?? null,
  }));
}

/**
 * Seq reassignments needed to move a match immediately after `afterId`
 * (null = to the front). The set of seq values stays the same — they just
 * rotate across the affected rows — so only the rows between the old and
 * new position are touched.
 */
function planMove(
  all: Match[],
  id: string,
  afterId: string | null,
): { id: string; seq: number }[] {
  const ordered = [...all].sort((a, b) => a.seq - b.seq);
  const slots = ordered.map((m) => m.seq);
  const from = ordered.findIndex((m) => m.id === id);
  if (from < 0) throw new Error("Match not found.");
  const [moved] = ordered.splice(from, 1);
  let to = 0;
  if (afterId !== null) {
    const anchor = ordered.findIndex((m) => m.id === afterId);
    if (anchor < 0) throw new Error("Target match not found.");
    to = anchor + 1;
  }
  ordered.splice(to, 0, moved);
  const current = new Map(all.map((m) => [m.id, m.seq]));
  return ordered
    .map((m, k) => ({ id: m.id, seq: slots[k] }))
    .filter((c) => current.get(c.id) !== c.seq);
}

const LOCAL_KEY = "vdl-tt-matches-v2";
const LOCAL_T_KEY = "vdl-tt-tournaments-v1";
const LOCAL_P_KEY = "vdl-tt-avatars-v1";
const LOCAL_D_KEY = "vdl-tt-trash-v1";
const LOCAL_S_KEY = "vdl-tt-sets-v1";

/** Full snapshot of a deleted player, enough to restore them completely */
interface TrashEntry {
  name: string;
  avatar: string | null;
  matches: Match[];
  deletedAt: string;
}

function readTrash(): TrashEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_D_KEY);
    return raw ? (JSON.parse(raw) as TrashEntry[]) : [];
  } catch {
    return [];
  }
}

function writeTrash(entries: TrashEntry[]) {
  localStorage.setItem(LOCAL_D_KEY, JSON.stringify(entries));
}

const localStore: DataStore = {
  mode: "local",
  async load() {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as Match[];
      } catch {
        // fall through to reseed
      }
    }
    const seeded = seedMatches();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(seeded));
    return seeded;
  },
  async add(m) {
    const all = await this.load();
    const seq = all.reduce((mx, x) => Math.max(mx, x.seq), 0) + 1;
    all.push({ ...m, id: crypto.randomUUID(), seq });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  },
  async remove(id) {
    const all = (await this.load()).filter((m) => m.id !== id);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  },
  async moveMatch(id, afterId) {
    const all = await this.load();
    const changes = planMove(all, id, afterId);
    if (changes.length === 0) return;
    const newSeq = new Map(changes.map((c) => [c.id, c.seq]));
    const updated = all
      .map((m) => (newSeq.has(m.id) ? { ...m, seq: newSeq.get(m.id)! } : m))
      .sort((a, b) => a.seq - b.seq);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  },
  async loadTournaments() {
    const raw = localStorage.getItem(LOCAL_T_KEY);
    if (raw) {
      try {
        const rows = JSON.parse(raw) as Tournament[];
        return rows.map((t) => ({ ...t, bracket: t.bracket ?? null }));
      } catch {
        // fall through to reseed
      }
    }
    localStorage.setItem(LOCAL_T_KEY, JSON.stringify(SEED_TOURNAMENTS));
    return SEED_TOURNAMENTS;
  },
  async addTournament(name, date) {
    const all = await this.loadTournaments();
    if (all.some((t) => t.name === name)) throw new Error("A tournament with that name already exists.");
    all.push({ id: crypto.randomUUID(), name, date, status: "active", bracket: null });
    localStorage.setItem(LOCAL_T_KEY, JSON.stringify(all));
  },
  async setTournamentStatus(id, status) {
    const all = (await this.loadTournaments()).map((t) =>
      t.id === id ? { ...t, status } : t,
    );
    localStorage.setItem(LOCAL_T_KEY, JSON.stringify(all));
  },
  async setTournamentBracket(id, bracket) {
    const all = (await this.loadTournaments()).map((t) =>
      t.id === id ? { ...t, bracket } : t,
    );
    localStorage.setItem(LOCAL_T_KEY, JSON.stringify(all));
  },
  async removeTournament(id) {
    const all = (await this.loadTournaments()).filter((t) => t.id !== id);
    localStorage.setItem(LOCAL_T_KEY, JSON.stringify(all));
  },
  async loadPlayers() {
    try {
      const raw = localStorage.getItem(LOCAL_P_KEY);
      const rec = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
      return Object.entries(rec).map(([name, avatar]) => ({ name, avatar }));
    } catch {
      return [];
    }
  },
  async setPlayerAvatar(name, avatar) {
    const raw = localStorage.getItem(LOCAL_P_KEY);
    const rec = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    rec[name] = avatar;
    localStorage.setItem(LOCAL_P_KEY, JSON.stringify(rec));
  },
  async addPlayer(name) {
    const raw = localStorage.getItem(LOCAL_P_KEY);
    const rec = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    if (name in rec) throw new Error("That player already exists.");
    rec[name] = null;
    localStorage.setItem(LOCAL_P_KEY, JSON.stringify(rec));
  },
  async renamePlayer(oldName, newName) {
    const all = (await this.load()).map((m) => ({
      ...m,
      player1: m.player1 === oldName ? newName : m.player1,
      player2: m.player2 === oldName ? newName : m.player2,
    }));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));

    const raw = localStorage.getItem(LOCAL_P_KEY);
    const rec = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    if (oldName in rec) {
      rec[newName] = rec[oldName];
      delete rec[oldName];
      localStorage.setItem(LOCAL_P_KEY, JSON.stringify(rec));
    }

    const ts = (await this.loadTournaments()).map((t) =>
      t.bracket
        ? { ...t, bracket: t.bracket.map((s) => (s === oldName ? newName : s)) }
        : t,
    );
    localStorage.setItem(LOCAL_T_KEY, JSON.stringify(ts));

    // Keep trashed snapshots consistent so a later restore uses the new name
    writeTrash(
      readTrash().map((t) => ({
        ...t,
        matches: t.matches.map((m) => ({
          ...m,
          player1: m.player1 === oldName ? newName : m.player1,
          player2: m.player2 === oldName ? newName : m.player2,
        })),
      })),
    );
  },
  async removePlayer(name) {
    const all = await this.load();
    const mine = all.filter((m) => m.player1 === name || m.player2 === name);
    const rest = all.filter((m) => m.player1 !== name && m.player2 !== name);

    const raw = localStorage.getItem(LOCAL_P_KEY);
    const rec = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};

    // Only players with recorded matches get a restore window
    if (mine.length > 0) {
      const trash = readTrash().filter((t) => t.name !== name);
      trash.push({
        name,
        avatar: rec[name] ?? null,
        matches: mine,
        deletedAt: new Date().toISOString(),
      });
      writeTrash(trash);
    }

    localStorage.setItem(LOCAL_KEY, JSON.stringify(rest));
    delete rec[name];
    localStorage.setItem(LOCAL_P_KEY, JSON.stringify(rec));
  },
  async loadTrash() {
    const all = readTrash();
    const cutoff = Date.now() - TRASH_MS;
    const keep = all.filter((t) => Date.parse(t.deletedAt) >= cutoff);
    if (keep.length !== all.length) writeTrash(keep); // lazy 30-day purge
    return keep.map((t) => ({
      name: t.name,
      matchCount: t.matches.length,
      deletedAt: t.deletedAt,
    }));
  },
  async restorePlayer(name) {
    const trash = readTrash();
    const entry = trash.find((t) => t.name === name);
    if (!entry) throw new Error("Nothing to restore for that player.");

    const all = await this.load();
    const ids = new Set(all.map((m) => m.id));
    const seqs = new Set(all.map((m) => m.seq));
    let nextSeq = all.reduce((mx, m) => Math.max(mx, m.seq), 0) + 1;
    for (const m of entry.matches) {
      if (ids.has(m.id)) continue;
      // matches added since the deletion may have reused seq numbers
      all.push(seqs.has(m.seq) ? { ...m, seq: nextSeq++ } : m);
    }
    all.sort((a, b) => a.seq - b.seq);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));

    const raw = localStorage.getItem(LOCAL_P_KEY);
    const rec = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    if (entry.avatar || !(name in rec)) rec[name] = entry.avatar;
    localStorage.setItem(LOCAL_P_KEY, JSON.stringify(rec));

    writeTrash(trash.filter((t) => t.name !== name));
  },
  async purgeDeletedPlayer(name) {
    writeTrash(readTrash().filter((t) => t.name !== name));
  },
  async loadSets() {
    try {
      const raw = localStorage.getItem(LOCAL_S_KEY);
      return raw ? (JSON.parse(raw) as SetRecordEntry[]) : [];
    } catch {
      return [];
    }
  },
  async addSet(s) {
    const all = await this.loadSets();
    all.push({ ...s, id: crypto.randomUUID() });
    localStorage.setItem(LOCAL_S_KEY, JSON.stringify(all));
  },
  async removeSet(id) {
    const all = (await this.loadSets()).filter((s) => s.id !== id);
    localStorage.setItem(LOCAL_S_KEY, JSON.stringify(all));
  },
};

function makeSupabaseStore(): DataStore {
  const sb = supabase!;
  return {
    mode: "supabase",
    async load() {
      const { data, error } = await sb
        .from("matches")
        .select("*")
        .order("seq", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        seq: Number(r.seq),
        date: String(r.date),
        player1: String(r.player1),
        player2: String(r.player2),
        winner: Number(r.winner) === 1 ? 1 : 2,
        score: r.score ? String(r.score) : null,
        tournament: r.tournament ? String(r.tournament) : null,
      }));
    },
    async add(m) {
      const { error } = await sb.from("matches").insert({
        date: m.date,
        player1: m.player1,
        player2: m.player2,
        winner: m.winner,
        score: m.score,
        tournament: m.tournament,
      });
      if (error) throw new Error(error.message);
    },
    async remove(id) {
      const { error } = await sb.from("matches").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async moveMatch(id, afterId) {
      const all = await this.load();
      const changes = planMove(all, id, afterId);
      if (changes.length === 0) return;
      const target = changes.find((c) => c.id === id)!;
      const others = changes.filter((c) => c.id !== id);
      const oldSeq = all.find((m) => m.id === id)!.seq;

      // seq has a unique index, so free a slot first: park the moved match
      // beyond the end, shift the in-between rows toward its old slot
      // (nearest first, so every write lands on a just-freed value), then
      // drop the moved match into its target.
      const parkSeq = all.reduce((mx, m) => Math.max(mx, m.seq), 0) + 1;
      let r = await sb.from("matches").update({ seq: parkSeq }).eq("id", id);
      if (r.error) throw new Error(r.error.message);

      const movingEarlier = target.seq < oldSeq;
      others.sort((a, b) => (movingEarlier ? b.seq - a.seq : a.seq - b.seq));
      for (const c of others) {
        r = await sb.from("matches").update({ seq: c.seq }).eq("id", c.id);
        if (r.error) throw new Error(r.error.message);
      }

      r = await sb.from("matches").update({ seq: target.seq }).eq("id", id);
      if (r.error) throw new Error(r.error.message);
    },
    async loadTournaments() {
      const { data, error } = await sb
        .from("tournaments")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        date: String(r.date),
        status: r.status === "completed" ? ("completed" as const) : ("active" as const),
        bracket: Array.isArray(r.bracket) ? (r.bracket as (string | null)[]) : null,
      }));
    },
    async addTournament(name, date) {
      const { error } = await sb.from("tournaments").insert({ name, date });
      if (error) throw new Error(error.message);
    },
    async setTournamentStatus(id, status) {
      const { error } = await sb.from("tournaments").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async setTournamentBracket(id, bracket) {
      const { error } = await sb.from("tournaments").update({ bracket }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async removeTournament(id) {
      const { error } = await sb.from("tournaments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async loadPlayers() {
      const { data, error } = await sb.from("players").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        name: String(r.name),
        avatar: r.avatar ? String(r.avatar) : null,
      }));
    },
    async setPlayerAvatar(name, avatar) {
      const { error } = await sb.from("players").upsert({ name, avatar });
      if (error) throw new Error(error.message);
    },
    async addPlayer(name) {
      const { error } = await sb.from("players").insert({ name });
      if (error) throw new Error(error.message);
    },
    async renamePlayer(oldName, newName) {
      let r = await sb.from("matches").update({ player1: newName }).eq("player1", oldName);
      if (r.error) throw new Error(r.error.message);
      r = await sb.from("matches").update({ player2: newName }).eq("player2", oldName);
      if (r.error) throw new Error(r.error.message);
      r = await sb.from("players").update({ name: newName }).eq("name", oldName);
      if (r.error) throw new Error(r.error.message);

      const { data, error } = await sb.from("tournaments").select("id, bracket");
      if (error) throw new Error(error.message);
      for (const t of data ?? []) {
        if (Array.isArray(t.bracket) && t.bracket.includes(oldName)) {
          const bracket = t.bracket.map((s: string | null) =>
            s === oldName ? newName : s,
          );
          const u = await sb.from("tournaments").update({ bracket }).eq("id", t.id);
          if (u.error) throw new Error(u.error.message);
        }
      }

      // Keep trashed snapshots consistent so a later restore uses the new name
      const dp = await sb.from("deleted_players").select("name, matches");
      if (!dp.error) {
        for (const row of dp.data ?? []) {
          if (!Array.isArray(row.matches)) continue;
          const rows = row.matches as Record<string, unknown>[];
          if (!rows.some((m) => m.player1 === oldName || m.player2 === oldName)) continue;
          const matches = rows.map((m) => ({
            ...m,
            player1: m.player1 === oldName ? newName : m.player1,
            player2: m.player2 === oldName ? newName : m.player2,
          }));
          const u = await sb.from("deleted_players").update({ matches }).eq("name", row.name);
          if (u.error) throw new Error(u.error.message);
        }
      }
    },
    async removePlayer(name) {
      // Snapshot everything first so the delete is recoverable
      const [r1, r2] = await Promise.all([
        sb.from("matches").select("*").eq("player1", name),
        sb.from("matches").select("*").eq("player2", name),
      ]);
      if (r1.error) throw new Error(r1.error.message);
      if (r2.error) throw new Error(r2.error.message);
      const byId = new Map<string, Record<string, unknown>>();
      for (const row of [...(r1.data ?? []), ...(r2.data ?? [])]) byId.set(String(row.id), row);
      const mine = [...byId.values()];

      if (mine.length > 0) {
        const { data: prow } = await sb
          .from("players")
          .select("avatar")
          .eq("name", name)
          .maybeSingle();
        const t = await sb.from("deleted_players").upsert({
          name,
          avatar: prow?.avatar ?? null,
          matches: mine,
          deleted_at: new Date().toISOString(),
        });
        if (t.error) throw new Error(t.error.message);
      }

      let r = await sb.from("matches").delete().eq("player1", name);
      if (r.error) throw new Error(r.error.message);
      r = await sb.from("matches").delete().eq("player2", name);
      if (r.error) throw new Error(r.error.message);
      r = await sb.from("players").delete().eq("name", name);
      if (r.error) throw new Error(r.error.message);
    },
    async loadTrash() {
      // Lazy 30-day purge; silently affects 0 rows for non-admins (RLS)
      const cutoff = new Date(Date.now() - TRASH_MS).toISOString();
      await sb.from("deleted_players").delete().lt("deleted_at", cutoff);

      const { data, error } = await sb
        .from("deleted_players")
        .select("name, deleted_at, matches")
        .order("deleted_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        name: String(r.name),
        matchCount: Array.isArray(r.matches) ? r.matches.length : 0,
        deletedAt: String(r.deleted_at),
      }));
    },
    async restorePlayer(name) {
      const { data: entry, error } = await sb
        .from("deleted_players")
        .select("*")
        .eq("name", name)
        .single();
      if (error) throw new Error(error.message);

      const rows = Array.isArray(entry.matches)
        ? (entry.matches as Record<string, unknown>[])
        : [];
      if (rows.length > 0) {
        const m = await sb.from("matches").upsert(rows, { onConflict: "id" });
        if (m.error) throw new Error(m.error.message);
      }
      const p = await sb.from("players").upsert({ name, avatar: entry.avatar ?? null });
      if (p.error) throw new Error(p.error.message);

      const d = await sb.from("deleted_players").delete().eq("name", name);
      if (d.error) throw new Error(d.error.message);
    },
    async purgeDeletedPlayer(name) {
      const { error } = await sb.from("deleted_players").delete().eq("name", name);
      if (error) throw new Error(error.message);
    },
    async loadSets() {
      const { data, error } = await sb
        .from("set_records")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        date: String(r.date),
        winner: String(r.winner),
        loser: String(r.loser),
        score: String(r.score),
      }));
    },
    async addSet(s) {
      const { error } = await sb.from("set_records").insert({
        date: s.date,
        winner: s.winner,
        loser: s.loser,
        score: s.score,
      });
      if (error) throw new Error(error.message);
    },
    async removeSet(id) {
      const { error } = await sb.from("set_records").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

export const store: DataStore = supabase ? makeSupabaseStore() : localStore;
