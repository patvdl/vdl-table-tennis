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
import { replay, leaderboard, type ReplayResult } from "../lib/elo";
import type { Match, PlayerStats } from "../types";

interface MatchesState {
  loading: boolean;
  error: string | null;
  matches: Match[];
  replayResult: ReplayResult;
  board: PlayerStats[];
  playerNames: string[];
  addMatch(m: NewMatch): Promise<void>;
  removeMatch(id: string): Promise<void>;
  refresh(): Promise<void>;
}

const MatchesContext = createContext<MatchesState | null>(null);

export function MatchesProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setMatches(await store.load());
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
  const playerNames = useMemo(
    () => [...replayResult.stats.keys()].sort((a, b) => a.localeCompare(b)),
    [replayResult],
  );

  const value: MatchesState = {
    loading,
    error,
    matches,
    replayResult,
    board,
    playerNames,
    async addMatch(m) {
      await store.add(m);
      await refresh();
    },
    async removeMatch(id) {
      await store.remove(id);
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
