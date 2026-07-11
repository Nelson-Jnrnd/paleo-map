/**
 * Exploration-view state (SPEC-003 REQ-001/004/005/007). Framework-light so it
 * is unit-testable independently of React and the map canvas. A reducer over the
 * loaded read model; every derivation is an in-memory filter with no I/O, so an
 * age change re-computes visible occurrences well within PERF-030 (NFR-003).
 *
 * SPEC-002's state-management open question is resolved, for this slice, as a
 * React reducer + context (assumption A-2); URL/deep-link state is out of scope.
 */

import { LATE_CRETACEOUS_STAGES } from '../../domain/index.js';
import type { GeologicalStage, ReadOccurrence } from '../../domain/index.js';
import type { ReadApi } from '../../read/api.js';

/** MVP window stages, oldest → youngest (deep-time reads left → right). */
export const EXPLORATION_STAGES: readonly GeologicalStage[] = LATE_CRETACEOUS_STAGES;

export const DEFAULT_STAGE = 'Maastrichtian';
/** MVP is dinosaurs-only (OQ-050); the group is present but vacuously satisfied. */
export const DEFAULT_GROUP = 'Dinosaurs';

export type Screen = 'map' | 'profile';

export interface ExplorationState {
  /** Selected geological stage — the timeline steps by stage (FONC-120). */
  stageName: string;
  /** Selected taxonomic group, permanently displayed (FONC-050). */
  group: string;
  selectedOccurrenceId: string | null;
  screen: Screen;
  profileTaxonId: string | null;
}

export const initialExplorationState: ExplorationState = {
  stageName: DEFAULT_STAGE,
  group: DEFAULT_GROUP,
  selectedOccurrenceId: null,
  screen: 'map',
  profileTaxonId: null,
};

export type ExplorationAction =
  | { type: 'selectStage'; stageName: string }
  | { type: 'selectOccurrence'; occurrenceId: string }
  | { type: 'clearSelection' }
  | { type: 'openProfile'; taxonId: string }
  | { type: 'backToMap' }
  | { type: 'reset' };

export function explorationReducer(
  state: ExplorationState,
  action: ExplorationAction,
): ExplorationState {
  switch (action.type) {
    case 'selectStage':
      // Age change: update in place; drop a selection that may no longer be
      // visible. Group/filters preserved (FONC-140, PERF-360).
      return { ...state, stageName: action.stageName, selectedOccurrenceId: null };
    case 'selectOccurrence':
      return { ...state, selectedOccurrenceId: action.occurrenceId, screen: 'map' };
    case 'clearSelection':
      return { ...state, selectedOccurrenceId: null };
    case 'openProfile':
      // Preserve selected age + filters across navigation (FONC-1010/1020).
      return { ...state, screen: 'profile', profileTaxonId: action.taxonId };
    case 'backToMap':
      // Single-action return; age, filters and the selected occurrence persist
      // (FONC-1000/1080, CONS-470).
      return { ...state, screen: 'map', profileTaxonId: null };
    case 'reset':
      // Reset filters to defaults (FONC-080); clears selection and view.
      return { ...initialExplorationState };
    default:
      return state;
  }
}

export function stageByName(name: string): GeologicalStage | undefined {
  return EXPLORATION_STAGES.find((s) => s.name === name);
}

/**
 * Visible occurrences for the current state: those whose known time range
 * overlaps the selected stage (FONC-150). The group filter is vacuous in the MVP
 * (every taxon is a dinosaur / main content). Pure, no I/O (NFR-003).
 */
export function visibleOccurrences(
  api: ReadApi,
  state: ExplorationState,
): ReadOccurrence[] {
  return api.listOccurrences({ stage: state.stageName });
}
