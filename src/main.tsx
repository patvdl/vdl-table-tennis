import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./store/auth";
import { MatchesProvider } from "./store/matches";
import "./index.css";

// HashRouter so deep links work on GitHub Pages without server rewrites
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <MatchesProvider>
          <App />
        </MatchesProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
