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

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactElement } from "react";
import type {
  GeologicalStage,
  ReadOccurrence,
  TimeRange,
} from "../../domain/index.js";
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
import { occurrencesInView } from "../state/viewport.js";
import type { Bounds } from "../state/viewport.js";
import { gateOccurrences } from "../state/wikipediaGate.js";
import { stageForTaxon, tierForRank } from "../state/search.js";
import type { SearchableTaxon } from "../state/search.js";
import {
  NOT_CLASSIFIED_KEY,
  groupByLocality,
  groupByTaxon,
  indexTaxaById,
  resolveTierTaxon,
} from "../state/grouping.js";
import { AppBar } from "./AppBar.js";
import type { BarScreen, Destination } from "./AppBar.js";
import { ContextBar } from "./ContextBar.js";
import { GroupingControls } from "./GroupingControls.js";
import { TimelineControl } from "./TimelineControl.js";
import { OccurrenceMap } from "./OccurrenceMap.js";
import { OccurrenceList } from "./OccurrenceList.js";
import { OccurrencePanel } from "./OccurrencePanel.js";
import { LocalityList, TaxonList } from "./GroupedList.js";
import { LocalityPanel, TaxonPanel } from "./GroupedPanels.js";
import { DailyGenusScreen } from "./DailyGenusScreen.js";
import { fragmentFor, parseFragment } from "../state/screenFragment.js";
import { TaxonProfile } from "./TaxonProfile.js";
import { TaxonomyScreen } from "./TaxonomyScreen.js";
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
  // The fragment is read *before* the first render, not dispatched after it
  // (SPEC-019 REQ-012, NFR-001). Applying it in an effect would let the map
  // mount for one pass first, and the map fetches its basemap index on mount —
  // so a cold boot at `#daily` would touch the network before the puzzle even
  // appeared.
  const [state, dispatch] = useReducer(
    explorationReducer,
    initialExplorationState,
    (base) => {
      const intent = parseFragment(globalThis.location?.hash ?? "");
      return intent
        ? explorationReducer(base, {
            type: "openDaily",
            mode: intent.mode,
            track: intent.track,
          })
        : base;
    },
  );
  const [stageAttempt, setStageAttempt] = useState(0);

  // SPEC-019 REQ-012: `#daily` / `#practice` open the puzzle, entering and
  // leaving keep the fragment in step, and the browser back control works
  // because entering the puzzle pushes a history entry. No router for this.
  //
  // The two effects below are deliberately one-way each. The reader runs on
  // mount and on real `hashchange` events only (empty deps): re-running it when
  // the screen changes would make the pair ping-pong — the reader would see the
  // not-yet-cleared `#daily` and re-open the screen the writer is in the middle
  // of leaving. The current screen therefore comes from a ref, not the closure.
  const screenRef = useRef(state.screen);
  screenRef.current = state.screen;

  useEffect(() => {
    const apply = (): void => {
      const intent = parseFragment(globalThis.location?.hash ?? "");
      if (intent)
        dispatch({ type: "openDaily", mode: intent.mode, track: intent.track });
      else if (screenRef.current === "daily") dispatch({ type: "backToMap" });
    };
    // No initial `apply()` — the boot fragment is already in the initial state.
    globalThis.addEventListener?.("hashchange", apply);
    return () => globalThis.removeEventListener?.("hashchange", apply);
  }, []);

  useEffect(() => {
    const wanted = fragmentFor(state.screen, state.dailyMode, state.dailyTrack);
    const current = globalThis.location?.hash ?? "";
    if (current === wanted || (wanted === "" && current === "#")) return;
    if (wanted) {
      // A new entry, so the back control returns to where the player came from.
      globalThis.location.hash = wanted;
    } else if (globalThis.history?.replaceState) {
      // Leaving replaces rather than pushes: the player has already gone back.
      const { pathname, search } = globalThis.location;
      globalThis.history.replaceState(null, "", `${pathname}${search}`);
    }
  }, [state.screen, state.dailyMode, state.dailyTrack]);

  // Map viewport bounds (null until the map reports them / when no WebGL) and the
  // transiently highlighted occurrence shared with the map (SPEC-009 REQ-003/004).
  const [viewport, setViewport] = useState<Bounds | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // SPEC-014 AMEND-005: default-hide taxa without a Wikipedia article (incl.
  // indeterminate occurrences). The toggle below reveals them.
  const [showAll, setShowAll] = useState(false);
  const stage = stageByName(state.stageName);
  const stageStatus = useStageOccurrences(stageSource, stage, stageAttempt);

  // The occurrences visible at the selected age: the fetched stage set in
  // partitioned mode, or the in-memory filter over the injected model.
  const rawOccurrences = useMemo(() => {
    if (stageStatus.kind === "ready") return stageStatus.occurrences;
    if (stageStatus.kind === "inMemory") return visibleOccurrences(api, state);
    return [];
  }, [stageStatus, api, state]);

  // SPEC-014 AMEND-005: the Wikipedia gate. By default only occurrences tied to a
  // Wikipedia-documented genus are shown — on the map and in every list; toggling
  // "show all" reveals the article-less and indeterminate ones. Keyed off the
  // reference taxa (which carry `wikipedia`), not the per-stage occurrence set.
  const gateTaxaById = useMemo(() => indexTaxaById(api.listTaxa()), [api]);
  const occurrences = useMemo(
    () => gateOccurrences(rawOccurrences, gateTaxaById, showAll),
    [rawOccurrences, gateTaxaById, showAll],
  );
  const hiddenCount = rawOccurrences.length - occurrences.length;
  // SPEC-014 AMEND-005: a taxon has a page iff it has a resolved Wikipedia article
  // (any rank). Drives the greyed "Open profile" affordances and the breadcrumb.
  const hasArticle = (id: string): boolean =>
    Boolean(gateTaxaById.get(id)?.wikipedia);

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

  // SPEC-013: in-memory taxon search index (every taxon + its notability and
  // common name), rebuilt only when the reference API changes.
  const searchIndex = useMemo<SearchableTaxon[]>(
    () =>
      api.listTaxa().map((t) => {
        const profile = api.getProfile(t.id);
        return {
          taxonId: t.id,
          scientificName: t.scientificName,
          commonName: profile?.commonName?.value ?? null,
          contentLevel: profile?.contentLevel ?? "OccurrenceOnly",
        };
      }),
    [api],
  );

  // Landing a search result (SPEC-013 REQ-004): switch to Taxon mode at the
  // taxon's tier, move the age into its recorded range if the current age misses
  // it, and select it — map emphasis + side panel, not a jump to the profile.
  const onSearchSelect = (taxonId: string): void => {
    const taxon = api.getTaxon(taxonId);
    const profile = api.getProfile(taxonId);
    dispatch({
      type: "selectSearchTaxon",
      taxonKey: taxonId,
      rank: tierForRank(taxon?.rank ?? "Genus"),
      stageName: stageForTaxon(
        profile?.timeSpan ?? null,
        state.stageName,
        EXPLORATION_STAGES,
      ),
    });
  };

  // The occurrences currently on the map: narrowed to the viewport, or the full
  // set when there is no viewport signal (SPEC-009 REQ-003).
  const inView = useMemo(
    () => occurrencesInView(occurrences, viewport),
    [occurrences, viewport],
  );

  // --- SPEC-010 grouping: derive locality/taxon groups from the in-view set ---
  const taxaById = useMemo(
    () => indexTaxaById(stageApi.listTaxa()),
    [stageApi],
  );

  // Locality markers for the map cover the whole stage; the list is viewport-linked.
  const mapLocalities = useMemo(
    () => (state.mode === "locality" ? groupByLocality(occurrences) : []),
    [state.mode, occurrences],
  );
  const listLocalities = useMemo(
    () => (state.mode === "locality" ? groupByLocality(inView) : []),
    [state.mode, inView],
  );
  const taxonGroups = useMemo(
    () =>
      state.mode === "taxon" ? groupByTaxon(inView, state.rank, taxaById) : [],
    [state.mode, state.rank, inView, taxaById],
  );

  const selectedLocality = useMemo(
    () =>
      listLocalities.find((g) => g.collectionId === state.selectedLocalityId) ??
      (state.selectedLocalityId
        ? (groupByLocality(occurrences).find(
            (g) => g.collectionId === state.selectedLocalityId,
          ) ?? null)
        : null),
    [listLocalities, occurrences, state.selectedLocalityId],
  );
  const localityOccurrences = useMemo(
    () =>
      selectedLocality
        ? occurrences.filter(
            (o) => o.collectionId === selectedLocality.collectionId,
          )
        : [],
    [selectedLocality, occurrences],
  );
  const selectedTaxonGroup = useMemo(
    () => taxonGroups.find((g) => g.key === state.selectedTaxonKey) ?? null,
    [taxonGroups, state.selectedTaxonKey],
  );
  const focusIds = useMemo(
    () =>
      state.mode === "taxon"
        ? (selectedTaxonGroup?.occurrenceIds ?? null)
        : null,
    [state.mode, selectedTaxonGroup],
  );

  // Route a map feature click to the mode's selection (SPEC-010 REQ-001…004).
  const handleMapSelect = (featureId: string): void => {
    if (state.mode === "locality") {
      dispatch({ type: "selectLocality", collectionId: featureId });
    } else if (state.mode === "taxon") {
      const occ = occurrences.find((o) => o.id === featureId);
      if (!occ) return;
      const resolved = resolveTierTaxon(occ.taxonId, state.rank, taxaById);
      dispatch({
        type: "selectTaxon",
        taxonKey: resolved ? resolved.id : NOT_CLASSIFIED_KEY,
      });
    } else {
      dispatch({ type: "selectOccurrence", occurrenceId: featureId });
    }
  };

  // Drop a stale highlight when the age changes (its occurrence may be gone).
  useEffect(() => {
    setHighlightedId(null);
  }, [state.stageName]);

  const selectedOccurrence = state.selectedOccurrenceId
    ? (occurrences.find((o) => o.id === state.selectedOccurrenceId) ?? null)
    : null;

  // SPEC-022 REQ-001/REQ-002: one bar, rendered by the shell for every screen,
  // so the return path is the same object everywhere. `shell` wraps each screen
  // rather than each screen rendering its own bar — that is what keeps the bar
  // identical on the loading, error and "no puzzle today" surfaces (UX-002).
  const navigate = (destination: Destination): void => {
    if (destination === "map") {
      dispatch({ type: "backToMap" });
    } else if (destination === "daily") {
      dispatch({ type: "openDaily", mode: "daily" });
    } else {
      // From the map in taxon mode the focus is seeded from the selection, as
      // before; from anywhere else the screen keeps the focus it already has and
      // is never silently reset to the root (REQ-002).
      dispatch({
        type: "openTaxonomy",
        taxonId:
          state.screen === "map" && state.mode === "taxon"
            ? state.selectedTaxonKey
            : state.taxonomyTaxonId,
      });
    }
  };

  const shell = (
    barScreen: BarScreen,
    content: ReactElement,
    contextRow?: ReactElement,
  ): ReactElement => (
    <div className={styles.app}>
      {/* The document's single banner: the bar, plus the exploration context on
          the map screen (REQ-001, REQ-005). */}
      <header role="banner">
        <AppBar screen={barScreen} onNavigate={navigate} />
        {contextRow}
      </header>
      {content}
    </div>
  );

  // SPEC-017: the dedicated taxonomy screen. Reached from the app bar or from a
  // selected taxon, and returning to the map in one action (OQ-040).
  if (state.screen === "taxonomy") {
    return shell(
      "taxonomy",
      <TaxonomyScreen
        api={stageApi}
        taxonId={state.taxonomyTaxonId}
        onSelectTaxon={(taxonId) => dispatch({ type: "openTaxonomy", taxonId })}
        {...(hasArticle(state.taxonomyTaxonId ?? "")
          ? {
              onOpenProfile: (taxonId: string) =>
                dispatch({ type: "openProfile", taxonId }),
            }
          : {})}
      />,
    );
  }

  // SPEC-019: the Dinordle puzzle. Same contract again — a screen in this
  // shell, addressable by fragment (REQ-012), returning to the map in one action.
  if (state.screen === "daily") {
    return shell(
      "daily",
      <DailyGenusScreen
        api={stageApi}
        mode={state.dailyMode}
        onModeChange={(mode) => dispatch({ type: "openDaily", mode })}
        track={state.dailyTrack}
        onTrackChange={(track) =>
          dispatch({ type: "openDaily", mode: state.dailyMode, track })
        }
        onOpenProfile={(taxonId) => dispatch({ type: "openProfile", taxonId })}
      />,
    );
  }

  if (state.screen === "profile" && state.profileTaxonId) {
    return shell(
      "profile",
      <TaxonProfile
        api={stageApi}
        taxonId={state.profileTaxonId}
        onOpenTaxon={(taxonId) => dispatch({ type: "openProfile", taxonId })}
      />,
    );
  }

  const selectPeriod = (period: string): void => {
    const target = representatives[period];
    if (target) dispatch({ type: "selectStage", stageName: target });
  };

  // The temporal extent highlighted on the timeline follows the current mode's
  // selection (SPEC-009 REQ-005): a selected occurrence's own range, or the Ma
  // span aggregated across a selected taxon/locality group.
  const spanRange = (
    group: { minMa: number | null; maxMa: number | null } | null,
  ): TimeRange | null =>
    group && group.minMa !== null && group.maxMa !== null
      ? { minMa: group.minMa, maxMa: group.maxMa }
      : null;
  const highlightRange: TimeRange | null =
    state.mode === "taxon"
      ? spanRange(selectedTaxonGroup)
      : state.mode === "locality"
        ? spanRange(selectedLocality)
        : (selectedOccurrence?.timeRange.value ?? null);

  return shell(
    "map",
    <>
      <TimelineControl
        stages={EXPLORATION_STAGES}
        periods={EXPLORATION_PERIODS}
        selected={state.stageName}
        onSelect={(stageName) => dispatch({ type: "selectStage", stageName })}
        onSelectPeriod={selectPeriod}
        highlightRange={highlightRange}
      />
      <div className={styles.body}>
        <div className={styles.mapPane} data-map-pane>
          {/* SPEC-023 REQ-002: app controls acting on what is plotted live in the
              bottom-right rail. The top-right corner is reserved for MapLibre's
              own controls, which is where this toggle used to collide with them.
              The top-left rail has no children since SPEC-021 removed the
              reconstruction label and the cluster note, so it does not render at
              all (REQ-001 — no empty box). */}
          <div
            className={`${styles.mapRail} ${styles.railBottomRight}`}
            data-map-rail="bottom-right"
          >
            <label
              className={styles.wikiGateToggle}
              data-map-overlay="wikipedia-gate"
            >
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              <span>
                Show taxa without a Wikipedia article
                {!showAll && hiddenCount > 0 && (
                  <span className={styles.wikiGateCount}>
                    {" "}
                    · {hiddenCount} hidden
                  </span>
                )}
              </span>
            </label>
          </div>
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
              selectedId={
                state.mode === "locality"
                  ? state.selectedLocalityId
                  : state.selectedOccurrenceId
              }
              onSelect={handleMapSelect}
              occurrenceRotationModel={stageApi.metadata().rotationModel}
              stageName={state.stageName}
              onViewportChange={setViewport}
              highlightedId={highlightedId}
              onHover={setHighlightedId}
              mode={state.mode}
              localities={mapLocalities}
              focusIds={focusIds}
              taxaById={taxaById}
              onOpenProfile={(taxonId) =>
                dispatch({ type: "openProfile", taxonId })
              }
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
          ) : (
            <>
              <GroupingControls
                mode={state.mode}
                rank={state.rank}
                onSelectMode={(mode) => dispatch({ type: "setMode", mode })}
                onSelectRank={(rank) => dispatch({ type: "setRank", rank })}
              />

              {state.mode === "occurrence" && (
                <>
                  {selectedOccurrence && (
                    <OccurrencePanel
                      api={stageApi}
                      occurrence={selectedOccurrence}
                      onOpenProfile={(taxonId) =>
                        dispatch({ type: "openProfile", taxonId })
                      }
                      onClose={() => dispatch({ type: "clearSelection" })}
                    />
                  )}
                  <OccurrenceList
                    occurrences={inView}
                    totalAtAge={occurrences.length}
                    viewportActive={viewport !== null}
                    selectedId={state.selectedOccurrenceId}
                    highlightedId={highlightedId}
                    onSelect={(occurrenceId) =>
                      dispatch({ type: "selectOccurrence", occurrenceId })
                    }
                    onHover={setHighlightedId}
                  />
                </>
              )}

              {state.mode === "locality" && (
                <>
                  {selectedLocality && (
                    <LocalityPanel
                      group={selectedLocality}
                      occurrences={localityOccurrences}
                      onOpenProfile={(taxonId) =>
                        dispatch({ type: "openProfile", taxonId })
                      }
                      hasArticle={hasArticle}
                      onClose={() => dispatch({ type: "clearSelection" })}
                    />
                  )}
                  <LocalityList
                    groups={listLocalities}
                    totalAtAge={occurrences.length}
                    viewportActive={viewport !== null}
                    selectedId={state.selectedLocalityId}
                    onSelect={(collectionId) =>
                      dispatch({ type: "selectLocality", collectionId })
                    }
                  />
                </>
              )}

              {state.mode === "taxon" && (
                <>
                  {selectedTaxonGroup && (
                    <TaxonPanel
                      group={selectedTaxonGroup}
                      onOpenProfile={(taxonId) =>
                        dispatch({ type: "openProfile", taxonId })
                      }
                      hasArticle={hasArticle}
                      onClose={() => dispatch({ type: "clearSelection" })}
                    />
                  )}
                  <TaxonList
                    groups={taxonGroups}
                    viewportActive={viewport !== null}
                    selectedKey={state.selectedTaxonKey}
                    onSelect={(taxonKey) =>
                      dispatch({ type: "selectTaxon", taxonKey })
                    }
                  />
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </>,
    <ContextBar
      stage={stage}
      stageName={state.stageName}
      group={state.group}
      count={occurrences.length}
      searchIndex={searchIndex}
      onSearchSelect={onSearchSelect}
      onReset={() => dispatch({ type: "reset" })}
    />,
  );
}
