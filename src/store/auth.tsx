import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import type { Role } from "../types";

interface AuthState {
  /** Null while Supabase session is still resolving */
  ready: boolean;
  email: string | null;
  role: Role;
  /** True when running without Supabase (local demo mode) */
  demoMode: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** Demo-mode only: toggle pretend-admin */
  setDemoAdmin(v: boolean): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("anon");
  const [demoAdmin, setDemoAdminState] = useState(
    () => localStorage.getItem("vdl-tt-demo-admin") === "1",
  );

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;

    async function resolveRole(userId: string | undefined, mail: string | null) {
      if (!userId) {
        setEmail(null);
        setRole("anon");
        return;
      }
      setEmail(mail);
      const { data } = await sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      setRole(data?.role === "admin" ? "admin" : "viewer");
    }

    sb.auth.getSession().then(({ data }) => {
      resolveRole(data.session?.user?.id, data.session?.user?.email ?? null).finally(
        () => setReady(true),
      );
    });

    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      resolveRole(session?.user?.id, session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    ready,
    email: supabase ? email : demoAdmin ? "demo-admin" : null,
    role: supabase ? role : demoAdmin ? "admin" : "anon",
    demoMode: !supabase,
    async signIn(mail, password) {
      if (!supabase) return "Supabase is not configured";
      const { error } = await supabase.auth.signInWithPassword({
        email: mail,
        password,
      });
      return error ? error.message : null;
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
    },
    setDemoAdmin(v) {
      localStorage.setItem("vdl-tt-demo-admin", v ? "1" : "0");
      setDemoAdminState(v);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
