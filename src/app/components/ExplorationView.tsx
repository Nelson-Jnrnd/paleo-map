/**
 * Exploration view (SPEC-003 REQ-001…006). The hub of the loop — combines the
 * context bar, the stage timeline, the paleogeographic map, and the occurrence
 * panel, keeping the main controls always visible (CONS-450). Holds the
 * exploration reducer and renders the profile screen when the loop navigates to a
 * taxon (REQ-007). SPEC-007 removed the occurrence list (REQ-003); occurrences are
 * selected from the map.
 */

import { useMemo, useReducer } from "react";
import type { ReactElement } from "react";
import type { ReadApi } from "../../read/api.js";
import {
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
import { EmptyState } from "./states.js";
import styles from "./exploration.module.css";

interface ExplorationViewProps {
  api: ReadApi;
}

export function ExplorationView({ api }: ExplorationViewProps): ReactElement {
  const [state, dispatch] = useReducer(
    explorationReducer,
    initialExplorationState,
  );

  const occurrences = useMemo(
    () => visibleOccurrences(api, state),
    [api, state],
  );
  const selectedOccurrence = state.selectedOccurrenceId
    ? (occurrences.find((o) => o.id === state.selectedOccurrenceId) ?? null)
    : null;
  const stage = stageByName(state.stageName);

  if (state.screen === "profile" && state.profileTaxonId) {
    return (
      <div className={styles.app}>
        <TaxonProfile
          api={api}
          taxonId={state.profileTaxonId}
          onBack={() => dispatch({ type: "backToMap" })}
        />
      </div>
    );
  }

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
        selected={state.stageName}
        onSelect={(stageName) => dispatch({ type: "selectStage", stageName })}
      />
      <div className={styles.body}>
        <div className={styles.mapPane}>
          <span className={styles.reconstructionBanner}>
            <span aria-hidden="true">▲</span> Paleogeographic reconstruction
          </span>
          <OccurrenceMap
            occurrences={occurrences}
            selectedId={state.selectedOccurrenceId}
            onSelect={(occurrenceId) =>
              dispatch({ type: "selectOccurrence", occurrenceId })
            }
            occurrenceRotationModel={api.metadata().rotationModel}
          />
        </div>
        <aside className={styles.sidebar} aria-label="Occurrence details">
          {occurrences.length === 0 ? (
            <EmptyState onReset={() => dispatch({ type: "reset" })} />
          ) : selectedOccurrence ? (
            <OccurrencePanel
              api={api}
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
