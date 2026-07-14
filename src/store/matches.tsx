import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { store, type NewMatch } from "./store";
import { replay, leaderboard, unratedPlayers, type ReplayResult } from "../lib/elo";
import { analyzeTournament, type TournamentAnalysis } from "../lib/bracket";
import type { Match, PlayerProfile, PlayerStats, Tournament } from "../types";

export interface TournamentSummary extends Tournament {
  analysis: TournamentAnalysis;
  /** Champion of a COMPLETED tournament (active ones have no champion yet) */
  champion: string | null;
}

interface MatchesState {
  loading: boolean;
  error: string | null;
  matches: Match[];
  replayResult: ReplayResult;
  board: PlayerStats[];
  /** Players with fewer than RATED_MIN matches — recorded but not ranked */
  unratedBoard: PlayerStats[];
  playerNames: string[];
  /** All tournaments, newest first, with derived bracket/podium info */
  tournaments: TournamentSummary[];
  /** Profile photos by player name (players without one use the letter placeholder) */
  avatars: Map<string, string>;
  setPlayerAvatar(name: string, avatar: string | null): Promise<void>;
  addMatch(m: NewMatch): Promise<void>;
  removeMatch(id: string): Promise<void>;
  addTournament(name: string, date: string): Promise<void>;
  setTournamentStatus(id: string, status: Tournament["status"]): Promise<void>;
  setTournamentBracket(id: string, bracket: Tournament["bracket"]): Promise<void>;
  removeTournament(id: string): Promise<void>;
  refresh(): Promise<void>;
}

const MatchesContext = createContext<MatchesState | null>(null);

export function MatchesProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournamentRows, setTournamentRows] = useState<Tournament[]>([]);
  const [playerRows, setPlayerRows] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setMatches(await store.load());
      try {
        setTournamentRows(await store.loadTournaments());
      } catch {
        // Tournaments are non-critical; keep the site alive if the table is missing
        setTournamentRows([]);
      }
      try {
        setPlayerRows(await store.loadPlayers());
      } catch {
        // Avatars are non-critical; letter placeholders cover everyone
        setPlayerRows([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const replayResult = useMemo(() => replay(matches), [matches]);
  const board = useMemo(() => leaderboard(replayResult.stats), [replayResult]);
  const unratedBoard = useMemo(
    () => unratedPlayers(replayResult.stats),
    [replayResult],
  );
  const playerNames = useMemo(
    () => [...replayResult.stats.keys()].sort((a, b) => a.localeCompare(b)),
    [replayResult],
  );

  const tournaments = useMemo<TournamentSummary[]>(
    () =>
      [...tournamentRows]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => {
          const analysis = analyzeTournament(
            replayResult.enriched.filter((m) => m.tournament === t.name),
            t.bracket,
          );
          return {
            ...t,
            analysis,
            champion: t.status === "completed" ? analysis.champion : null,
          };
        }),
    [tournamentRows, replayResult],
  );

  const avatars = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of playerRows) if (p.avatar) m.set(p.name, p.avatar);
    return m;
  }, [playerRows]);

  const value: MatchesState = {
    loading,
    error,
    matches,
    replayResult,
    board,
    unratedBoard,
    playerNames,
    tournaments,
    avatars,
    async setPlayerAvatar(name, avatar) {
      await store.setPlayerAvatar(name, avatar);
      await refresh();
    },
    async addMatch(m) {
      await store.add(m);
      await refresh();
    },
    async removeMatch(id) {
      await store.remove(id);
      await refresh();
    },
    async addTournament(name, date) {
      await store.addTournament(name, date);
      await refresh();
    },
    async setTournamentStatus(id, status) {
      await store.setTournamentStatus(id, status);
      await refresh();
    },
    async setTournamentBracket(id, bracket) {
      await store.setTournamentBracket(id, bracket);
      await refresh();
    },
    async removeTournament(id) {
      await store.removeTournament(id);
      await refresh();
    },
    refresh,
  };

  return (
    <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>
  );
}

export function useMatches(): MatchesState {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error("useMatches outside MatchesProvider");
  return ctx;
}
