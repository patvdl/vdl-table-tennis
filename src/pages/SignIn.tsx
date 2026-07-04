import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function SignIn() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.demoMode) {
    return (
      <div className="card" style={{ maxWidth: 460, margin: "0 auto" }}>
        <h2>Sign in</h2>
        <div className="notice info">
          Running in <strong>local demo mode</strong> (no Supabase configured). Use the
          "admin" toggle in the header to try match entry. To enable real accounts,
          follow the Supabase setup steps in the README.
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await auth.signIn(email, password);
    setBusy(false);
    if (err) setError(err);
    else navigate("/");
  };

  return (
    <div className="card" style={{ maxWidth: 460, margin: "0 auto" }}>
      <h2>Sign in</h2>
      <p className="sub">
        Viewing is open to everyone — sign in only if you need to record matches.
      </p>
      {error && <div className="notice err">{error}</div>}
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label className="field">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="field">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
