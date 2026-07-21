/**
 * Production entry point (SPEC-002 REQ-003). Mounts the static SPA and injects
 * the real loader — a fetch of the prebuilt local snapshot artifact — so the
 * runtime reads only its own bundled data (SPEC-003 NFR-001).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./App.js";
import { fetchReadModel } from "./data/snapshot.js";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App loader={(onProgress) => fetchReadModel(undefined, onProgress)} />
  </StrictMode>,
);
