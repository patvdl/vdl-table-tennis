import { supabase } from "../lib/supabase";
import type { Match } from "../types";
import seedRaw from "../data/seed-matches.json";

export type StoreMode = "supabase" | "local";

export interface NewMatch {
  date: string;
  player1: string;
  player2: string;
  winner: 1 | 2;
  score: string | null;
}

export interface DataStore {
  mode: StoreMode;
  load(): Promise<Match[]>;
  add(m: NewMatch): Promise<void>;
  remove(id: string): Promise<void>;
}

type SeedRow = [string, string, string, number];

function seedMatches(): Match[] {
  return (seedRaw as SeedRow[]).map((row, i) => ({
    id: `seed-${i + 1}`,
    seq: i + 1,
    date: row[0],
    player1: row[1],
    player2: row[2],
    winner: row[3] === 1 ? 1 : 2,
    score: null,
  }));
}

const LOCAL_KEY = "vdl-tt-matches-v1";

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
};

function makeSupabaseStore(): DataStore {
  const sb = supabase!;
  return {
    mode: "supabase",
    async load() {
      const { data, error } = await sb
        .from("matches")
        .select("id, seq, date, player1, player2, winner, score")
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
      }));
    },
    async add(m) {
      const { error } = await sb.from("matches").insert({
        date: m.date,
        player1: m.player1,
        player2: m.player2,
        winner: m.winner,
        score: m.score,
      });
      if (error) throw new Error(error.message);
    },
    async remove(id) {
      const { error } = await sb.from("matches").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

export const store: DataStore = supabase ? makeSupabaseStore() : localStore;
