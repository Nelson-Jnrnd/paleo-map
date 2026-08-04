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
import { landingForTaxon, stageForTaxon } from "../state/search.js";
import type { SearchableTaxon } from "../state/search.js";
import {
  NOT_CLASSIFIED_KEY,
  groupByLocality,
  groupByTaxon,
  indexTaxaById,
  resolveTierTaxon,
} from "../state/grouping.js";
import { ContextBar } from "./ContextBar.js";
import { GroupingControls } from "./GroupingControls.js";
import { TimelineControl } from "./TimelineControl.js";
import { OccurrenceMap } from "./OccurrenceMap.js";
import { OccurrenceList } from "./OccurrenceList.js";
import { OccurrencePanel } from "./OccurrencePanel.js";
import { LocalityList, TaxonList } from "./GroupedList.js";
import { LocalityPanel, TaxonPanel } from "./GroupedPanels.js";
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

  const taxaById = useMemo(
    () => indexTaxaById(stageApi.listTaxa()),
    [stageApi],
  );

  // How the last search landed (SPEC-017 REQ-004). Only set when the Explorer
  // needs to be told something: the search resolved to an ancestor rather than
  // the name they typed, or it could not resolve at all.
  // Each carries the state it was raised against, so it is shown only while it
  // is still about what the Explorer is looking at — no effect, no stale notice.
  type SearchOutcome =
    | {
        kind: "substituted";
        taxonKey: string;
        searched: string;
        landed: string;
      }
    | {
        kind: "unreachable";
        searched: string;
        atStage: string;
        atMode: string;
      };
  const [searchOutcome, setSearchOutcome] = useState<SearchOutcome | null>(
    null,
  );
  // Bumped only by a search landing (SPEC-017 REQ-003) so the map frames the
  // taxon exactly once — a list selection or a map click must never move the
  // camera, and neither may a re-render of the same selection.
  const [fitToken, setFitToken] = useState(0);

  // Landing a search result (SPEC-013 REQ-004; SPEC-017 REQ-003/004): switch to
  // Taxon mode at the tier that actually holds the taxon, move the age into its
  // recorded range if the current age misses it, select it, and frame it — map
  // emphasis + side panel, not a jump to the profile.
  const onSearchSelect = (taxonId: string): void => {
    const landing = landingForTaxon(taxonId, taxaById);
    if (!landing) {
      // No ancestor of this taxon can key a group at any tier, so there is
      // nothing to select. Say so instead of silently changing mode and stage.
      setSearchOutcome({
        kind: "unreachable",
        searched: api.getTaxon(taxonId)?.scientificName ?? taxonId,
        atStage: state.stageName,
        atMode: state.mode,
      });
      return;
    }
    setSearchOutcome(
      landing.substitutedFrom
        ? {
            kind: "substituted",
            taxonKey: landing.taxonKey,
            searched: landing.substitutedFrom,
            landed: landing.landedName,
          }
        : null,
    );
    const profile = api.getProfile(taxonId);
    dispatch({
      type: "selectSearchTaxon",
      taxonKey: landing.taxonKey,
      rank: landing.rank,
      stageName: stageForTaxon(
        profile?.timeSpan ?? null,
        state.stageName,
        EXPLORATION_STAGES,
      ),
    });
    setFitToken((n) => n + 1);
  };

  // The occurrences currently on the map: narrowed to the viewport, or the full
  // set when there is no viewport signal (SPEC-009 REQ-003).
  const inView = useMemo(
    () => occurrencesInView(occurrences, viewport),
    [occurrences, viewport],
  );

  // --- SPEC-010 grouping: derive locality/taxon groups from the in-view set ---

  // Locality markers for the map cover the whole stage; the list is viewport-linked.
  const mapLocalities = useMemo(
    () => (state.mode === "locality" ? groupByLocality(occurrences) : []),
    [state.mode, occurrences],
  );
  const listLocalities = useMemo(
    () => (state.mode === "locality" ? groupByLocality(inView) : []),
    [state.mode, inView],
  );
  // The list is a "what's on screen" device, so it groups the in-view set
  // (SPEC-010 REQ-004). The *selection* is not: a taxon stays selected — with
  // its panel, focus and timeline span — wherever the camera happens to be, so
  // it resolves against the whole stage (SPEC-017 REQ-002). Same split the
  // localities above already make between map and list.
  const taxonGroups = useMemo(
    () =>
      state.mode === "taxon" ? groupByTaxon(inView, state.rank, taxaById) : [],
    [state.mode, state.rank, inView, taxaById],
  );
  const stageTaxonGroups = useMemo(
    () =>
      state.mode === "taxon"
        ? groupByTaxon(occurrences, state.rank, taxaById)
        : [],
    [state.mode, state.rank, occurrences, taxaById],
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
    () =>
      stageTaxonGroups.find((g) => g.key === state.selectedTaxonKey) ?? null,
    [stageTaxonGroups, state.selectedTaxonKey],
  );
  const focusIds = useMemo(
    () =>
      state.mode === "taxon"
        ? (selectedTaxonGroup?.occurrenceIds ?? null)
        : null,
    [state.mode, selectedTaxonGroup],
  );
  // A taxon is selected but has no occurrences at this age (SPEC-017 REQ-004):
  // the panel must explain that rather than leave the sidebar blank.
  const absentTaxonName =
    state.mode === "taxon" && state.selectedTaxonKey && !selectedTaxonGroup
      ? (taxaById.get(state.selectedTaxonKey)?.scientificName ??
        state.selectedTaxonKey)
      : null;
  // The disclosure only belongs to the selection it was recorded for.
  const substitution =
    searchOutcome?.kind === "substituted" &&
    searchOutcome.taxonKey === state.selectedTaxonKey
      ? searchOutcome
      : null;
  // An unreachable search dispatches nothing, so its notice stands until the
  // Explorer moves the age or the grouping mode themselves.
  const unreachable =
    searchOutcome?.kind === "unreachable" &&
    searchOutcome.atStage === state.stageName &&
    searchOutcome.atMode === state.mode
      ? searchOutcome
      : null;
  // The occurrences the map should frame after a search landing (REQ-003).
  const focusOccurrences = useMemo(() => {
    if (!focusIds || focusIds.length === 0) return [];
    const ids = new Set(focusIds);
    return occurrences.filter((o) => ids.has(o.id));
  }, [focusIds, occurrences]);

  // Select the taxon-mode group that holds a given taxon, rolling it up to the
  // active tier (SPEC-010 REQ-005). Shared by map-point clicks and the cluster
  // aggregate card, so picking a species out of a cluster selects it rather than
  // leaving the map for the profile (SPEC-017 REQ-005).
  const handleSelectTaxonId = (taxonId: string): void => {
    const resolved = resolveTierTaxon(taxonId, state.rank, taxaById);
    dispatch({
      type: "selectTaxon",
      taxonKey: resolved ? resolved.id : NOT_CLASSIFIED_KEY,
    });
  };

  // Route a map feature click to the mode's selection (SPEC-010 REQ-001…004).
  const handleMapSelect = (featureId: string): void => {
    if (state.mode === "locality") {
      dispatch({ type: "selectLocality", collectionId: featureId });
    } else if (state.mode === "taxon") {
      const occ = occurrences.find((o) => o.id === featureId);
      if (!occ) return;
      handleSelectTaxonId(occ.taxonId);
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

  if (state.screen === "profile" && state.profileTaxonId) {
    return (
      <div className={styles.app}>
        <TaxonProfile
          api={stageApi}
          taxonId={state.profileTaxonId}
          onBack={() => dispatch({ type: "backToMap" })}
          onOpenTaxon={(taxonId) => dispatch({ type: "openProfile", taxonId })}
        />
      </div>
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

  return (
    <div className={styles.app}>
      <ContextBar
        stage={stage}
        stageName={state.stageName}
        group={state.group}
        count={occurrences.length}
        searchIndex={searchIndex}
        onSearchSelect={onSearchSelect}
        onReset={() => dispatch({ type: "reset" })}
      />
      <TimelineControl
        stages={EXPLORATION_STAGES}
        periods={EXPLORATION_PERIODS}
        selected={state.stageName}
        onSelect={(stageName) => dispatch({ type: "selectStage", stageName })}
        onSelectPeriod={selectPeriod}
        highlightRange={highlightRange}
      />
      <div className={styles.body}>
        <div className={styles.mapPane}>
          <span className={styles.reconstructionBanner}>
            <span aria-hidden="true">▲</span> Paleogeographic reconstruction
          </span>
          <label className={styles.wikiGateToggle}>
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
          {/* SPEC-010 AMEND-001 made this note the accessible carrier of cluster
              meaning, so it belongs in every mode that renders clusters — taxon
              mode included (SPEC-017 REQ-007). While a taxon is focused it also
              has to say that the counts are unfiltered, because the discs keep
              counting the records they dim. */}
          <p className={styles.mapLegend} role="note">
            {state.mode === "locality"
              ? "Each marker is one locality; clusters count how many localities are grouped here — not distinct taxa."
              : "Clusters count fossil records at a location (density), not distinct taxa."}
            {focusIds && focusIds.length > 0 && (
              <>
                {" "}
                A cluster’s count still includes the dimmed records, not only
                the selected taxon’s.
              </>
            )}
          </p>
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
              focusOccurrences={focusOccurrences}
              fitToken={fitToken}
              taxaById={taxaById}
              onOpenProfile={(taxonId) =>
                dispatch({ type: "openProfile", taxonId })
              }
              onSelectTaxon={
                state.mode === "taxon" ? handleSelectTaxonId : undefined
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

              {/* SPEC-017 REQ-004: the search matched a real taxon, but nothing
                  in its ancestry is a level the map groups by, so there is no
                  group to select. Say which name and why. */}
              {unreachable && (
                <p className={styles.notice} role="status">
                  <span className="sciName">{unreachable.searched}</span> isn’t
                  a level the map groups by, and none of the groups above it are
                  either — so it can’t be selected. Try a genus, a family, or a
                  major group.
                </p>
              )}

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
                      substitutedFrom={substitution?.searched ?? null}
                    />
                  )}
                  {/* SPEC-017 REQ-004: selected, but not present at this age —
                      the panel explains instead of leaving a void. */}
                  {absentTaxonName && (
                    <p className={styles.notice} role="status">
                      <span className="sciName">{absentTaxonName}</span> has no
                      records in the {state.stageName}. Step the timeline to an
                      age within its range, or clear the selection.
                    </p>
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
    </div>
  );
}
