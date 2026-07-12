import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./store/auth";
import { useMatches } from "./store/matches";
import Leaderboard from "./pages/Leaderboard";
import HeadToHeadPage from "./pages/HeadToHead";
import MatchHistory from "./pages/MatchHistory";
import Tournaments from "./pages/Tournaments";
import AddMatch from "./pages/AddMatch";
import PlayerPage from "./pages/Player";
import SignIn from "./pages/SignIn";

export default function App() {
  const auth = useAuth();
  const { loading, error } = useMatches();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <div className="brand-ball" />
          <h1>
            VDL <span>Table Tennis</span>
          </h1>
        </div>
        <div className="auth-area">
          {auth.demoMode ? (
            <>
              <span className="badge neutral">demo mode</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={auth.role === "admin"}
                  onChange={(e) => auth.setDemoAdmin(e.target.checked)}
                />
                admin
              </label>
            </>
          ) : auth.email ? (
            <>
              <span>
                {auth.email}{" "}
                <span className={`badge ${auth.role === "admin" ? "gold" : "neutral"}`}>
                  {auth.role}
                </span>
              </span>
              <button className="btn ghost" onClick={() => auth.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/signin" className="btn ghost">
              Sign in
            </NavLink>
          )}
        </div>
      </header>

      <nav className="nav">
        <NavLink to="/" end>
          Leaderboard
        </NavLink>
        <NavLink to="/head-to-head">Head-to-Head</NavLink>
        <NavLink to="/matches">Match History</NavLink>
        <NavLink to="/tournaments">Tournaments</NavLink>
        {auth.role === "admin" && <NavLink to="/add">Add Match</NavLink>}
      </nav>

      {error && <div className="notice err">Failed to load matches: {error}</div>}

      {loading ? (
        <div className="card">
          <p className="sub">Loading matches…</p>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/head-to-head" element={<HeadToHeadPage />} />
          <Route path="/matches" element={<MatchHistory />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/add" element={<AddMatch />} />
          <Route path="/player/:name" element={<PlayerPage />} />
          <Route path="/signin" element={<SignIn />} />
        </Routes>
      )}

      <footer className="foot">
        VDL Table Tennis — family ELO ratings since July 2024
      </footer>
    </div>
  );
}
