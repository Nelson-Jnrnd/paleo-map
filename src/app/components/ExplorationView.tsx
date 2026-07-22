/**
 * Exploration view (SPEC-003 REQ-001…006; SPEC-008 REQ-002/003/005). The hub of
 * the loop — combines the context bar, the stage timeline, the paleogeographic
 * map, and the occurrence panel, keeping the main controls always visible
 * (CONS-450). Holds the exploration reducer and renders the profile screen when
 * the loop navigates to a taxon (REQ-007). SPEC-007 removed the occurrence list
 * (REQ-003); occurrences are selected from the map.
 *
 * SPEC-008 makes the occurrence set **stage-partitioned**. In production a
 * `stageSource` is provided: stepping the timeline fetches only the active
 * stage's occurrences (aborting any superseded fetch) and joins them to the
 * shared reference `api`. When no `stageSource` is given (tests injecting a full
 * model), the view falls back to the in-memory filter — same behaviour as before.
 */

import { useEffect, useMemo, useReducer, useState } from "react";
import type { ReactElement } from "react";
import type { GeologicalStage, ReadOccurrence } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import type { StageSource } from "../data/atlas.js";
import { representativeByPeriod } from "../data/atlas.js";
import {
  DEFAULT_REPRESENTATIVE_STAGE,
  EXPLORATION_PERIODS,
  EXPLORATION_STAGES,
  explorationReducer,
  initialExplorationState,
  stageByName,
  visibleOccurrences,
} from "../state/exploration.js";
import { ContextBar } from "./ContextBar.js";
import { TimelineControl } from "./TimelineControl.js";
import { OccurrenceMap } from "./OccurrenceMap.js";
import { OccurrencePanel } from "./OccurrencePanel.js";
import { TaxonProfile } from "./TaxonProfile.js";
import { EmptyState, ErrorState, LoadingState } from "./states.js";
import styles from "./exploration.module.css";

interface ExplorationViewProps {
  /** Shared reference API (metadata/sources/taxa/profiles; occurrences per stage). */
  api: ReadApi;
  /** Present in partitioned (production) mode; absent for in-memory tests. */
  stageSource?: StageSource | undefined;
}

type StageStatus =
  | { kind: "inMemory" }
  | { kind: "loading" }
  | { kind: "ready"; occurrences: ReadOccurrence[] }
  | { kind: "error"; message: string };

/**
 * Load the active stage's occurrences (SPEC-008 REQ-005). No-op ("inMemory")
 * when no `stageSource` is provided. Aborts a superseded fetch on stage change
 * so a slow response can never overwrite a newer one (rapid-stepping edge case).
 */
function useStageOccurrences(
  stageSource: StageSource | undefined,
  stage: GeologicalStage | undefined,
  attempt: number,
): StageStatus {
  const [status, setStatus] = useState<StageStatus>(
    stageSource ? { kind: "loading" } : { kind: "inMemory" },
  );

  useEffect(() => {
    if (!stageSource || !stage) {
      setStatus({ kind: "inMemory" });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setStatus({ kind: "loading" });
    stageSource
      .loadStageOccurrences(stage, controller.signal)
      .then((occurrences) => {
        if (active) setStatus({ kind: "ready", occurrences });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || !active) return;
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [stageSource, stage, attempt]);

  return status;
}

export function ExplorationView({
  api,
  stageSource,
}: ExplorationViewProps): ReactElement {
  const [state, dispatch] = useReducer(
    explorationReducer,
    initialExplorationState,
  );
  const [stageAttempt, setStageAttempt] = useState(0);
  const stage = stageByName(state.stageName);
  const stageStatus = useStageOccurrences(stageSource, stage, stageAttempt);

  // The occurrences visible at the selected age: the fetched stage set in
  // partitioned mode, or the in-memory filter over the injected model.
  const occurrences = useMemo(() => {
    if (stageStatus.kind === "ready") return stageStatus.occurrences;
    if (stageStatus.kind === "inMemory") return visibleOccurrences(api, state);
    return [];
  }, [stageStatus, api, state]);

  // A per-stage API joins the shared reference to the active occurrences, so the
  // panel/profile resolve taxa, sources and this stage's occurrences (REQ-005).
  const stageApi = useMemo(
    () => (stageSource ? api.withOccurrences(occurrences) : api),
    [stageSource, api, occurrences],
  );

  const representatives = useMemo(
    () =>
      stageSource
        ? {
            ...DEFAULT_REPRESENTATIVE_STAGE,
            ...representativeByPeriod(stageSource.index),
          }
        : DEFAULT_REPRESENTATIVE_STAGE,
    [stageSource],
  );

  const selectedOccurrence = state.selectedOccurrenceId
    ? (occurrences.find((o) => o.id === state.selectedOccurrenceId) ?? null)
    : null;

  if (state.screen === "profile" && state.profileTaxonId) {
    return (
      <div className={styles.app}>
        <TaxonProfile
          api={stageApi}
          taxonId={state.profileTaxonId}
          onBack={() => dispatch({ type: "backToMap" })}
        />
      </div>
    );
  }

  const selectPeriod = (period: string): void => {
    const target = representatives[period];
    if (target) dispatch({ type: "selectStage", stageName: target });
  };

  return (
    <div className={styles.app}>
      <ContextBar
        stage={stage}
        stageName={state.stageName}
        group={state.group}
        count={occurrences.length}
        onReset={() => dispatch({ type: "reset" })}
      />
      <TimelineControl
        stages={EXPLORATION_STAGES}
        periods={EXPLORATION_PERIODS}
        selected={state.stageName}
        onSelect={(stageName) => dispatch({ type: "selectStage", stageName })}
        onSelectPeriod={selectPeriod}
      />
      <div className={styles.body}>
        <div className={styles.mapPane}>
          <span className={styles.reconstructionBanner}>
            <span aria-hidden="true">▲</span> Paleogeographic reconstruction
          </span>
          {stageStatus.kind === "error" ? (
            <ErrorState
              message={stageStatus.message}
              onRetry={() => setStageAttempt((n) => n + 1)}
            />
          ) : stageStatus.kind === "loading" ? (
            <LoadingState label={`Loading ${state.stageName}…`} />
          ) : (
            <OccurrenceMap
              occurrences={occurrences}
              selectedId={state.selectedOccurrenceId}
              onSelect={(occurrenceId) =>
                dispatch({ type: "selectOccurrence", occurrenceId })
              }
              occurrenceRotationModel={stageApi.metadata().rotationModel}
              stageName={state.stageName}
            />
          )}
        </div>
        <aside className={styles.sidebar} aria-label="Occurrence details">
          {stageStatus.kind === "loading" || stageStatus.kind === "error" ? (
            <div className={styles.stateWrap} role="status">
              <p className={styles.stateTitle}>
                {stageStatus.kind === "error"
                  ? "Could not load this stage."
                  : `Loading ${state.stageName}…`}
              </p>
            </div>
          ) : occurrences.length === 0 ? (
            <EmptyState onReset={() => dispatch({ type: "reset" })} />
          ) : selectedOccurrence ? (
            <OccurrencePanel
              api={stageApi}
              occurrence={selectedOccurrence}
              onOpenProfile={(taxonId) =>
                dispatch({ type: "openProfile", taxonId })
              }
              onClose={() => dispatch({ type: "clearSelection" })}
            />
          ) : (
            <div className={styles.stateWrap} role="status">
              <p className={styles.stateTitle}>
                Select a point on the map to inspect an occurrence.
              </p>
              <p className={styles.source}>
                {occurrences.length} occurrences at this age.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
