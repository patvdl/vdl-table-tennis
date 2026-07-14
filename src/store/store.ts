import { supabase } from "../lib/supabase";
import type { Match, PlayerProfile, Tournament } from "../types";
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
  loadTournaments(): Promise<Tournament[]>;
  addTournament(name: string, date: string): Promise<void>;
  setTournamentStatus(id: string, status: Tournament["status"]): Promise<void>;
  setTournamentBracket(id: string, bracket: Tournament["bracket"]): Promise<void>;
  removeTournament(id: string): Promise<void>;
  loadPlayers(): Promise<PlayerProfile[]>;
  /** Set a player's profile photo (data URL); null removes it */
  setPlayerAvatar(name: string, avatar: string | null): Promise<void>;
}

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

const LOCAL_KEY = "vdl-tt-matches-v2";
const LOCAL_T_KEY = "vdl-tt-tournaments-v1";
const LOCAL_P_KEY = "vdl-tt-avatars-v1";

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
      const rec = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      return Object.entries(rec).map(([name, avatar]) => ({ name, avatar }));
    } catch {
      return [];
    }
  },
  async setPlayerAvatar(name, avatar) {
    const raw = localStorage.getItem(LOCAL_P_KEY);
    const rec = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (avatar) rec[name] = avatar;
    else delete rec[name];
    localStorage.setItem(LOCAL_P_KEY, JSON.stringify(rec));
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
      if (avatar) {
        const { error } = await sb.from("players").upsert({ name, avatar });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from("players").delete().eq("name", name);
        if (error) throw new Error(error.message);
      }
    },
  };
}

export const store: DataStore = supabase ? makeSupabaseStore() : localStore;
