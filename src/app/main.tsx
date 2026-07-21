/**
 * Production entry point (SPEC-002 REQ-003; SPEC-008 REQ-005). Mounts the static
 * SPA and injects the stage-partitioned atlas loader: boot fetches the index +
 * shared reference (with download progress), and the exploration view fetches
 * only the active stage's occurrences thereafter — the runtime reads only its own
 * bundled data (SPEC-003 NFR-001).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./App.js";
import {
  bootAtlas,
  fetchStageOccurrences,
  referenceModel,
} from "./data/atlas.js";
import type { AtlasIndex, StageSource } from "./data/atlas.js";
import type { ModelLoader } from "./data/snapshot.js";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

// The index is discovered during boot; the stage source closes over it so a
// timeline step fetches exactly one per-stage file.
let index: AtlasIndex | null = null;

const loader: ModelLoader = async (onProgress) => {
  const boot = await bootAtlas(onProgress);
  index = boot.index;
  return referenceModel(boot.reference);
};

const stageSource: StageSource = {
  get index(): AtlasIndex {
    if (!index) throw new Error("Atlas index not booted");
    return index;
  },
  loadStageOccurrences: (stage, signal) => {
    const entry = index?.stages.find((s) => s.name === stage.name);
    return entry ? fetchStageOccurrences(entry, signal) : Promise.resolve([]);
  },
};

createRoot(rootEl).render(
  <StrictMode>
    <App loader={loader} stageSource={stageSource} />
  </StrictMode>,
);
