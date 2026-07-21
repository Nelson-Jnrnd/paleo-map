/**
 * App shell (SPEC-003 REQ-008, NFR-001; SPEC-008 REQ-005). Owns the boot
 * lifecycle: loading → ready → error, with a Retry that re-runs the injected
 * loader (FONC-1260/1310/1330). The loader is a prop so the production entry
 * point injects the atlas boot (index + shared reference) with an optional
 * `stageSource` for per-stage fetches, while tests inject a full model directly —
 * no network, no runtime backend.
 */

import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { ReadApi } from "../read/api.js";
import type { LoadProgress, ModelLoader } from "./data/snapshot.js";
import { readApiFromModel } from "./data/snapshot.js";
import type { StageSource } from "./data/atlas.js";
import { ExplorationView } from "./components/ExplorationView.js";
import { ErrorState, LoadingState } from "./components/states.js";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; api: ReadApi }
  | { kind: "error"; message: string };

export function App({
  loader,
  stageSource,
}: {
  loader: ModelLoader;
  stageSource?: StageSource;
}): ReactElement {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    setProgress(null);
    loader((p) => {
      if (!cancelled) setProgress(p);
    })
      .then((model) => {
        if (!cancelled)
          setStatus({ kind: "ready", api: readApiFromModel(model) });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loader, attempt]);

  if (status.kind === "loading") {
    return <LoadingState progress={progress} />;
  }
  if (status.kind === "error") {
    return (
      <ErrorState
        message={status.message}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }
  return <ExplorationView api={status.api} stageSource={stageSource} />;
}
