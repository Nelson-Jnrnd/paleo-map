/**
 * Exploration-view state (SPEC-003 REQ-001/004/005/007). Framework-light so it
 * is unit-testable independently of React and the map canvas. A reducer over the
 * loaded read model; every derivation is an in-memory filter with no I/O, so an
 * age change re-computes visible occurrences well within PERF-030 (NFR-003).
 *
 * SPEC-002's state-management open question is resolved, for this slice, as a
 * React reducer + context (assumption A-2); URL/deep-link state is out of scope.
 */

import { MESOZOIC_PERIODS, MESOZOIC_STAGES } from "../../domain/index.js";
import type { GeologicalStage, ReadOccurrence } from "../../domain/index.js";
import type { ReadApi } from "../../read/api.js";
import { DEFAULT_RANK_TIER, modeAndRankOf } from "./grouping.js";
import type { GroupingMode, ListUnit, RankTier } from "./grouping.js";
import type { FrameMode } from "./frame.js";

/** Full Mesozoic stages, oldest → youngest (deep-time reads left → right). */
export const EXPLORATION_STAGES: readonly GeologicalStage[] = MESOZOIC_STAGES;

/** The three Mesozoic periods, for the timeline's period quick-select (REQ-003). */
export const EXPLORATION_PERIODS: readonly string[] = MESOZOIC_PERIODS;

export const DEFAULT_STAGE = "Maastrichtian";

/**
 * A sensible default representative stage per period for the quick-select jump
 * (SPEC-008 REQ-003) when the runtime index supplies no data-driven choice. The
 * production app overrides these with the most-populated stage from the index.
 */
export const DEFAULT_REPRESENTATIVE_STAGE: Readonly<Record<string, string>> = {
  Triassic: "Norian",
  Jurassic: "Kimmeridgian",
  Cretaceous: "Maastrichtian",
};
/** MVP is dinosaurs-only (OQ-050); the group is present but vacuously satisfied. */
export const DEFAULT_GROUP = "Dinosaurs";

export type Screen = "map" | "profile" | "taxonomy" | "daily";

/** Which round the Dinordle screen opens in (SPEC-019 REQ-010/012). */
export type DailyMode = "daily" | "practice";

/** Which of the two parallel puzzles (SPEC-020 REQ-004/007). */
export type DailyTrack = "full" | "wellKnown";

export type { GroupingMode, ListUnit, RankTier } from "./grouping.js";

export interface ExplorationState {
  /** Selected geological stage — the timeline steps by stage (FONC-120). */
  stageName: string;
  /** Selected taxonomic group, permanently displayed (FONC-050). */
  group: string;
  /** Grouping unit for the map + list (SPEC-010 REQ-001). */
  mode: GroupingMode;
  /** Rank tier for taxon-mode roll-up (SPEC-010 REQ-005). */
  rank: RankTier;
  selectedOccurrenceId: string | null;
  /** Selected locality (collection id) in locality mode (SPEC-010 REQ-003). */
  selectedLocalityId: string | null;
  /** Selected taxon group key (rolled-up taxon id) in taxon mode (REQ-004). */
  selectedTaxonKey: string | null;
  screen: Screen;
  profileTaxonId: string | null;
  /** Taxon in focus on the taxonomy screen (SPEC-017). Null → the scope root. */
  taxonomyTaxonId: string | null;
  /** Round the Dinordle screen is playing (SPEC-019 REQ-010). */
  dailyMode: DailyMode;
  /** Which parallel puzzle it is playing (SPEC-020 REQ-004). */
  dailyTrack: DailyTrack;
  /**
   * Which frame the map draws (SPEC-029 REQ-002). Paleogeographic by default:
   * deep time is the product's subject, so it is what you see first. Survives a
   * timeline step by living here rather than inside the map.
   */
  frameMode: FrameMode;
}

export const initialExplorationState: ExplorationState = {
  stageName: DEFAULT_STAGE,
  group: DEFAULT_GROUP,
  mode: "occurrence",
  rank: DEFAULT_RANK_TIER,
  selectedOccurrenceId: null,
  selectedLocalityId: null,
  selectedTaxonKey: null,
  screen: "map",
  profileTaxonId: null,
  taxonomyTaxonId: null,
  dailyMode: "daily",
  dailyTrack: "full",
  frameMode: "paleo",
};

export type ExplorationAction =
  | { type: "selectStage"; stageName: string }
  // SPEC-026 API-001: one atomic action for the flat unit selector. It sets
  // mode and rank together, because the control asks one question.
  | { type: "setUnit"; unit: ListUnit }
  | { type: "selectOccurrence"; occurrenceId: string }
  | { type: "selectLocality"; collectionId: string }
  | { type: "selectTaxon"; taxonKey: string }
  | {
      // Search result chosen (SPEC-013 REQ-004): land the taxon in context — switch
      // to Taxon mode at the tier that holds it, move the age into its range if
      // needed, and select it (map emphasis + side panel), rather than opening the
      // profile directly. The component computes rank + stage from the taxon.
      type: "selectSearchTaxon";
      taxonKey: string;
      rank: RankTier;
      stageName: string;
    }
  | { type: "clearSelection" }
  | { type: "openProfile"; taxonId: string }
  | { type: "openTaxonomy"; taxonId: string | null }
  | { type: "openDaily"; mode: DailyMode; track?: DailyTrack }
  | { type: "setFrameMode"; frameMode: FrameMode }
  | { type: "backToMap" }
  | { type: "reset" };

/** Clear every per-mode selection — used on mode/stage/rank changes. */
const NO_SELECTION = {
  selectedOccurrenceId: null,
  selectedLocalityId: null,
  selectedTaxonKey: null,
} as const;

export function explorationReducer(
  state: ExplorationState,
  action: ExplorationAction,
): ExplorationState {
  switch (action.type) {
    case "selectStage":
      // Age change: update in place; drop a selection that may no longer be
      // visible. Group/mode/filters preserved (FONC-140, PERF-360).
      return {
        ...state,
        stageName: action.stageName,
        ...NO_SELECTION,
      };
    case "setUnit": {
      // Switch the row unit; drop selections that no longer map. Stage and
      // (upstream) the map viewport are preserved (SPEC-010 REQ-001). The rank
      // carries through the non-taxon units, so leaving Genus for Occurrence and
      // coming back lands on Genus again rather than resetting the tier.
      const { mode, rank } = modeAndRankOf(action.unit, state.rank);
      return { ...state, mode, rank, ...NO_SELECTION };
    }
    case "selectOccurrence":
      return {
        ...state,
        ...NO_SELECTION,
        selectedOccurrenceId: action.occurrenceId,
        screen: "map",
      };
    case "selectLocality":
      return {
        ...state,
        ...NO_SELECTION,
        selectedLocalityId: action.collectionId,
      };
    case "selectTaxon":
      return { ...state, ...NO_SELECTION, selectedTaxonKey: action.taxonKey };
    case "selectSearchTaxon":
      return {
        ...state,
        mode: "taxon",
        rank: action.rank,
        stageName: action.stageName,
        ...NO_SELECTION,
        selectedTaxonKey: action.taxonKey,
        screen: "map",
      };
    case "clearSelection":
      return { ...state, ...NO_SELECTION };
    case "openProfile":
      // Preserve selected age + filters across navigation (FONC-1010/1020).
      return { ...state, screen: "profile", profileTaxonId: action.taxonId };
    case "openTaxonomy":
      // SPEC-017: the dedicated taxonomy screen. Same navigation contract as the
      // profile — age and filters survive, and one action returns to the map.
      return {
        ...state,
        screen: "taxonomy",
        taxonomyTaxonId: action.taxonId,
      };
    case "openDaily":
      // SPEC-019: the puzzle is a screen in this shell, not a routed page —
      // same navigation contract as the taxonomy screen, so age and filters
      // survive and one action returns to the map (REQ-012).
      return {
        ...state,
        screen: "daily",
        dailyMode: action.mode,
        dailyTrack: action.track ?? state.dailyTrack,
      };
    case "backToMap":
      // Single-action return; age, filters and the selected occurrence persist
      // (FONC-1000/1080, CONS-470).
      return { ...state, screen: "map", profileTaxonId: null };
    case "setFrameMode":
      // Only the frame. The stage, the selection and the grouping are all
      // unaffected — switching frames re-projects what is already there
      // (SPEC-029 NFR-003).
      return { ...state, frameMode: action.frameMode };
    case "reset":
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
