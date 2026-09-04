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
import type { FrameMode } from "../state/frame.js";
import type { Bounds } from "../state/viewport.js";
import { gateOccurrences } from "../state/wikipediaGate.js";
import { landingForTaxon, stageForTaxon } from "../state/search.js";
import type { SearchableTaxon } from "../state/search.js";
import {
  LIST_UNIT_LABEL,
  classifiesAt,
  groupByLocality,
  groupByTaxon,
  indexTaxaById,
  isTaxonUnit,
  resolveTierTaxon,
  unitOf,
} from "../state/grouping.js";
import { AppBar } from "./AppBar.js";
import type { BarScreen, Destination } from "./AppBar.js";
import { ContextBar } from "./ContextBar.js";
import { GroupingControls } from "./GroupingControls.js";
import { UnitList } from "./UnitList.js";
import type { UnitRow } from "./UnitList.js";
import { cladeMarkerForTaxon } from "./mapCladeMarkers.js";
import { formatMaRange } from "../format.js";
import { TimelineControl } from "./TimelineControl.js";
import { OccurrenceMap } from "./OccurrenceMap.js";
import { OccurrencePanel } from "./OccurrencePanel.js";
import { LocalityPanel, TaxonPanel } from "./GroupedPanels.js";
import { DailyGenusScreen } from "./DailyGenusScreen.js";
import { fragmentFor, parseFragment } from "../state/screenFragment.js";
import { TaxonProfile } from "./TaxonProfile.js";
import { TaxonomyScreen } from "./TaxonomyScreen.js";
import { EmptyState, ErrorState, LoadingState } from "./states.js";
import { OccurrenceSheet } from "./OccurrenceSheet.js";
import { usePhoneLayout } from "../state/media.js";
import { AgeStrip } from "./AgeStrip.js";
import { MapControlsDrawer } from "./MapControlsDrawer.js";
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
  // SPEC-029 UX-002: whether the basemap index carries a present-day frame. The
  // map reports it once the index resolves; until then, and when it is absent,
  // no frame control is offered at all.
  const [presentFrameAvailable, setPresentFrameAvailable] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // SPEC-030 REQ-003: below the breakpoint the sidebar column becomes a sheet
  // over a full-bleed map. Layout only — what the column *contains* is
  // identical, so this branches the container and nothing else.
  const phoneLayout = usePhoneLayout();
  // The phone controls drawer. Closed on load — the map is the subject of this
  // screen, and everything in here is one tap away from the age strip.
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // SPEC-026 API-001: the flat unit the sidebar's one control selects.
  const unit = unitOf(state.mode, state.rank);

  // SPEC-026 REQ-004 (owner instruction, 2026-08-14): at a taxon unit, a record
  // that does not classify at the tier is excluded — from the list, from the
  // count *and* from the map, filtered once here so all three agree. Without the
  // map filter a point could exist with no row behind it, which would break both
  // the two-way highlight and map selection. Those records are unchanged at the
  // Occurrence and Locality units.
  const unitOccurrences = useMemo(
    () =>
      isTaxonUnit(unit)
        ? occurrences.filter((o) => classifiesAt(o, state.rank, gateTaxaById))
        : occurrences,
    [occurrences, unit, state.rank, gateTaxaById],
  );
  // SPEC-014 AMEND-005: a taxon has a page iff it has a resolved Wikipedia article
  // (any rank). Drives the greyed "Open profile" affordances and the breadcrumb.
  const hasArticle = (id: string): boolean =>
    Boolean(gateTaxaById.get(id)?.wikipedia);

  // A per-stage API joins the shared reference to the active occurrences, so the
  // panel/profile resolve taxa, sources and this stage's occurrences (REQ-005).
  const stageApi = useMemo(
    () => (stageSource ? api.withOccurrences(unitOccurrences) : api),
    [stageSource, api, unitOccurrences],
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

  // How the last search landed (SPEC-027 REQ-004). Only set when the Explorer
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
  // Bumped only by a search landing (SPEC-027 REQ-003) so the map frames the
  // taxon exactly once — a list selection or a map click must never move the
  // camera, and neither may a re-render of the same selection.
  const [fitToken, setFitToken] = useState(0);

  // Landing a search result (SPEC-013 REQ-004; SPEC-027 REQ-003/004): switch to
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
    // SPEC-029 REQ-003: the list mirrors the map, so it filters on the frame the
    // map is actually drawing.
    () => occurrencesInView(unitOccurrences, viewport, state.frameMode),
    [unitOccurrences, viewport, state.frameMode],
  );

  // --- SPEC-010 grouping: derive locality/taxon groups from the in-view set ---

  // Locality markers for the map cover the whole stage; the list is viewport-linked.
  const mapLocalities = useMemo(
    () => (state.mode === "locality" ? groupByLocality(unitOccurrences) : []),
    [state.mode, unitOccurrences],
  );
  const listLocalities = useMemo(
    () => (state.mode === "locality" ? groupByLocality(inView) : []),
    [state.mode, inView],
  );
  // The list is a "what's on screen" device, so it groups the in-view set
  // (SPEC-010 REQ-004). The *selection* is not: a taxon stays selected — with
  // its panel, focus and timeline span — wherever the camera happens to be, so
  // it resolves against the whole stage (SPEC-027 REQ-002). Same split the
  // localities above already make between map and list.
  //
  // Both sides fold `unitOccurrences`, the SPEC-026 REQ-004 filtered set, so the
  // list, the count, the map and the selection cannot disagree about which
  // records exist at this unit.
  const taxonGroups = useMemo(
    () =>
      state.mode === "taxon" ? groupByTaxon(inView, state.rank, taxaById) : [],
    [state.mode, state.rank, inView, taxaById],
  );
  const stageTaxonGroups = useMemo(
    () =>
      state.mode === "taxon"
        ? groupByTaxon(unitOccurrences, state.rank, taxaById)
        : [],
    [state.mode, state.rank, unitOccurrences, taxaById],
  );

  const selectedLocality = useMemo(
    () =>
      listLocalities.find((g) => g.collectionId === state.selectedLocalityId) ??
      (state.selectedLocalityId
        ? (groupByLocality(unitOccurrences).find(
            (g) => g.collectionId === state.selectedLocalityId,
          ) ?? null)
        : null),
    [listLocalities, unitOccurrences, state.selectedLocalityId],
  );
  const localityOccurrences = useMemo(
    () =>
      selectedLocality
        ? unitOccurrences.filter(
            (o) => o.collectionId === selectedLocality.collectionId,
          )
        : [],
    [selectedLocality, unitOccurrences],
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
  // A taxon is selected but has no occurrences at this age (SPEC-027 REQ-004):
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
    return unitOccurrences.filter((o) => ids.has(o.id));
  }, [focusIds, unitOccurrences]);

  // Select the taxon-mode group that holds a given taxon, rolling it up to the
  // active tier (SPEC-010 REQ-005). Shared by map-point clicks and the cluster
  // aggregate card, so picking a species out of a cluster selects it rather than
  // leaving the map for the profile (SPEC-027 REQ-005).
  const handleSelectTaxonId = (taxonId: string): void => {
    // SPEC-026 REQ-004 retired the not-classified bucket, so a taxon that does
    // not resolve at this tier has no group to select — selecting nothing beats
    // selecting a key with no row behind it.
    const resolved = resolveTierTaxon(taxonId, state.rank, taxaById);
    if (resolved) dispatch({ type: "selectTaxon", taxonKey: resolved.id });
  };

  // A group's aggregate Ma span, shared by the row meta line and the timeline
  // highlight (SPEC-009 REQ-005).
  const spanRange = (
    group: { minMa: number | null; maxMa: number | null } | null,
  ): TimeRange | null =>
    group && group.minMa !== null && group.maxMa !== null
      ? { minMa: group.minMa, maxMa: group.maxMa }
      : null;

  // ── SPEC-026 REQ-002: the five units, mapped to one row shape ─────────────
  // Content varies by unit; structure does not. Every row is a name line plus a
  // meta line of at most two values (owner review, 2026-08-14), and the clade is
  // carried by a tint plus the row's accessible name — never by a third subtitle.
  const unitLabel =
    unit === "occurrence"
      ? "Occurrences on the map"
      : unit === "locality"
        ? "Localities on the map"
        : `${LIST_UNIT_LABEL[unit]} on the map`;
  const unitNoun =
    unit === "occurrence"
      ? // Pluralised properly rather than "occurrence(s)": since the sheet's
        // resting label is now this string, it is read constantly.
        occurrences.length === 1
        ? "occurrence"
        : "occurrences"
      : unit === "locality"
        ? "localities"
        : unit === "genus"
          ? "genera"
          : unit === "family"
            ? "families"
            : "major groups";

  const unitRows = useMemo<UnitRow[]>(() => {
    const cladeOf = (taxonId: string): { tint: string; label: string } => {
      const marker = cladeMarkerForTaxon(taxonId, taxaById);
      return { tint: marker.tint, label: marker.label };
    };
    if (unit === "occurrence") {
      return inView.map((o) => {
        const clade = cladeOf(o.taxonId);
        const ma = formatMaRange(o.timeRange.value);
        return {
          key: o.id,
          name: o.taxonName,
          scientific: true,
          // Formation is cut from the row and lives in the detail (REQ-002).
          meta: [ma, o.collectionName],
          cladeTint: clade.tint,
          accessibleName: `${o.taxonName}, ${clade.label}, ${ma}, ${o.collectionName}`,
        };
      });
    }
    if (unit === "locality") {
      return listLocalities.map((g) => ({
        key: g.collectionId,
        name: g.name,
        scientific: false,
        // REQ-002: the distinct-taxon count survives; the present-day region
        // replaces the formation and Ma range, which move to the detail.
        meta: [`${g.taxonCount} taxa`, g.region ?? "Region not recorded"],
        // A locality is a place, not a clade — no tint (UX-002).
        cladeTint: null,
        accessibleName: `${g.name}, ${g.taxonCount} distinct taxa, ${g.region ?? "region not recorded"}`,
      }));
    }
    return taxonGroups.map((g) => {
      const clade = cladeOf(g.taxonId);
      const ma = formatMaRange(spanRange(g));
      return {
        key: g.key,
        name: g.name,
        scientific: true,
        meta: [`${g.count} occurrences`, ma],
        cladeTint: clade.tint,
        accessibleName: `${g.name}, ${clade.label}, ${g.count} occurrences, ${ma}`,
      };
    });
  }, [unit, inView, listLocalities, taxonGroups, taxaById]);

  const selectedKey =
    unit === "occurrence"
      ? state.selectedOccurrenceId
      : unit === "locality"
        ? state.selectedLocalityId
        : state.selectedTaxonKey;

  const selectRow = (key: string): void => {
    if (unit === "occurrence")
      dispatch({ type: "selectOccurrence", occurrenceId: key });
    else if (unit === "locality")
      dispatch({ type: "selectLocality", collectionId: key });
    else dispatch({ type: "selectTaxon", taxonKey: key });
  };

  // REQ-006: the two-way highlight works in every unit. A row reports its whole
  // occurrence-id set upward; for the Occurrence unit that set is the row itself.
  const highlightRow = (key: string | null): void => {
    if (key === null) {
      setHighlightedId(null);
      return;
    }
    if (unit === "occurrence") {
      setHighlightedId(key);
      return;
    }
    const ids =
      unit === "locality"
        ? (listLocalities.find((g) => g.collectionId === key)?.occurrenceIds ??
          [])
        : (taxonGroups.find((g) => g.key === key)?.occurrenceIds ?? []);
    setHighlightedId(ids[0] ?? null);
  };

  const highlightedKey =
    unit === "occurrence"
      ? highlightedId
      : highlightedId === null
        ? null
        : unit === "locality"
          ? (listLocalities.find((g) => g.occurrenceIds.includes(highlightedId))
              ?.collectionId ?? null)
          : (taxonGroups.find((g) => g.occurrenceIds.includes(highlightedId))
              ?.key ?? null);

  // Route a map feature click to the mode's selection (SPEC-010 REQ-001…004).
  const handleMapSelect = (featureId: string): void => {
    if (state.mode === "locality") {
      dispatch({ type: "selectLocality", collectionId: featureId });
    } else if (state.mode === "taxon") {
      const occ = occurrences.find((o) => o.id === featureId);
      if (!occ) return;
      // SPEC-026 REQ-004: at a taxon unit the map plots only classifying
      // records, so a clicked point always resolves. The guard is kept because a
      // stale click during a unit switch must not select a key with no row.
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

  // REQ-003: the back control names the list it returns to, so a player always
  // knows what "back" costs them. `null` when nothing is selected — the list
  // renders instead.
  const backLabel = `Back to ${unitRows.length} ${unitNoun}${viewport !== null ? " in view" : ""}`;
  const detail: ReactElement | null =
    unit === "occurrence" && selectedOccurrence ? (
      <OccurrencePanel
        api={stageApi}
        occurrence={selectedOccurrence}
        onOpenProfile={(taxonId) => dispatch({ type: "openProfile", taxonId })}
        onClose={() => dispatch({ type: "clearSelection" })}
        backLabel={backLabel}
      />
    ) : unit === "locality" && selectedLocality ? (
      <LocalityPanel
        group={selectedLocality}
        occurrences={localityOccurrences}
        onOpenProfile={(taxonId) => dispatch({ type: "openProfile", taxonId })}
        hasArticle={hasArticle}
        onClose={() => dispatch({ type: "clearSelection" })}
        backLabel={backLabel}
      />
    ) : isTaxonUnit(unit) && selectedTaxonGroup ? (
      <TaxonPanel
        group={selectedTaxonGroup}
        onOpenProfile={(taxonId) => dispatch({ type: "openProfile", taxonId })}
        hasArticle={hasArticle}
        onClose={() => dispatch({ type: "clearSelection" })}
        backLabel={backLabel}
        clade={cladeMarkerForTaxon(selectedTaxonGroup.taxonId, taxaById).label}
        // SPEC-027 REQ-004: when the search landed on an ancestor rather than
        // the name that was typed, the panel says so.
        substitutedFrom={substitution?.searched ?? null}
      />
    ) : null;

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
  // span aggregated across a selected taxon/locality group. Declared above,
  // beside the row mapping that also uses it.
  const highlightRange: TimeRange | null =
    state.mode === "taxon"
      ? spanRange(selectedTaxonGroup)
      : state.mode === "locality"
        ? spanRange(selectedLocality)
        : (selectedOccurrence?.timeRange.value ?? null);

  // SPEC-023 AMEND-003. On the map it is a rail child; on a phone it renders in
  // the sheet, with the unit selector.
  //
  // Measured at 320×568: the toggle's label wraps to four lines (80px tall) on a
  // map pane that is 175px tall, of which the resting sheet leaves ~60px above
  // it. No chrome trim closes that gap — the control does not fit on the map at
  // the narrowest supported width. It is also the one overlay that is a *list
  // filter* rather than a statement about the map, so the sheet is where it
  // belongs anyway: it gives the map back 80px at every phone width, and
  // CONS-450 is better served by a control visible beside the list it filters
  // than by one pushed off the map.
  const wikipediaGate = (
    <label className={styles.wikiGateToggle} data-map-overlay="wikipedia-gate">
      <input
        type="checkbox"
        checked={showAll}
        onChange={(e) => setShowAll(e.target.checked)}
      />
      <span>
        Show taxa without a Wikipedia article
        {!showAll && hiddenCount > 0 && (
          <span className={styles.wikiGateCount}> · {hiddenCount} hidden</span>
        )}
      </span>
    </label>
  );

  // What the sheet's handle says at rest. While a detail is open the list is not
  // what is showing, so it names the selection rather than claiming a count of
  // rows it is not displaying.
  const detailName = selectedOccurrence
    ? selectedOccurrence.taxonName
    : selectedLocality
      ? selectedLocality.name
      : (selectedTaxonGroup?.name ?? null);
  const sheetSummary =
    detail && detailName
      ? detailName
      : `${unitRows.length} ${unitNoun}${viewport !== null ? " in view" : ""}`;

  const columnContents = (
    <>
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
          {/* SPEC-026 AMEND-002: on a phone the list's own controls stand down
              while a detail is open. REQ-003 keeps them beside the detail in a
              full-height desktop column; in a 290px sheet they cost 130px of
              the 160px the detail had, so tapping a row showed the same two
              controls again and pushed the taxon and its back link off the
              bottom. They return with the list. */}
          {!(phoneLayout && detail) && (
            <>
              <GroupingControls
                unit={unit}
                onSelectUnit={(next) =>
                  dispatch({ type: "setUnit", unit: next })
                }
              />
              {phoneLayout && (
                <div className={styles.sheetGate}>{wikipediaGate}</div>
              )}
            </>
          )}

          {/* SPEC-027 REQ-004: the app tells the Explorer what it did
                with their search when that is not what they typed. Both sit
                above the detail-or-list block, because in each case there is
                no detail to carry them: the first made no selection at all,
                the second selected a group with nothing at this age. */}
          {unreachable && (
            <p className={styles.notice} role="status">
              <span className="sciName">{unreachable.searched}</span> isn’t a
              level the map groups by, and none of the groups above it are
              either — so it can’t be selected. Try a genus, a family, or a
              major group.
            </p>
          )}
          {absentTaxonName && (
            <p className={styles.notice} role="status">
              <span className="sciName">{absentTaxonName}</span> has no records
              in the {state.stageName}. Step the timeline to an age within its
              range, or clear the selection.
            </p>
          )}

          {/* REQ-003: a selection *replaces* the list in the same column
                rather than stacking above it. Stacking pushed the list out of
                a 360px column, so choosing a row cost you the list you were
                reading. The unit selector above stays operable throughout. */}
          {detail ?? (
            <UnitList
              label={unitLabel}
              noun={unitNoun}
              rows={unitRows}
              totalAtAge={unitOccurrences.length}
              viewportActive={viewport !== null}
              selectedKey={selectedKey}
              highlightedKey={highlightedKey}
              onSelect={selectRow}
              onHighlight={highlightRow}
            />
          )}
        </>
      )}
    </>
  );

  // One ContextBar, two homes: the shell's banner on desktop, the drawer on a
  // phone. Declared once so the two cannot drift.
  const contextControls = (
    <ContextBar
      stage={stage}
      stageName={state.stageName}
      group={state.group}
      count={occurrences.length}
      frameMode={state.frameMode}
      {...(presentFrameAvailable
        ? {
            onFrameModeChange: (frameMode: FrameMode) =>
              dispatch({ type: "setFrameMode", frameMode }),
          }
        : {})}
      searchIndex={searchIndex}
      onSearchSelect={onSearchSelect}
      onReset={() => dispatch({ type: "reset" })}
    />
  );

  return shell(
    "map",
    <>
      {/* SPEC-030 REQ-005/REQ-006 as amended: on a phone the full to-scale
          timeline and the context row's controls move into a drawer, and the
          strip keeps the age readout, one-tap stepping and the group/count.
          Above the breakpoint both render exactly as before (NFR-002). */}
      {phoneLayout ? (
        <>
          <AgeStrip
            stages={EXPLORATION_STAGES}
            selected={state.stageName}
            stage={stage}
            onSelect={(stageName) =>
              dispatch({ type: "selectStage", stageName })
            }
            group={state.group}
            count={occurrences.length}
            drawerOpen={drawerOpen}
            onToggleDrawer={() => setDrawerOpen((open) => !open)}
          />
          <MapControlsDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onReset={() => dispatch({ type: "reset" })}
          >
            {contextControls}
            <TimelineControl
              stages={EXPLORATION_STAGES}
              periods={EXPLORATION_PERIODS}
              selected={state.stageName}
              onSelect={(stageName) =>
                dispatch({ type: "selectStage", stageName })
              }
              onSelectPeriod={selectPeriod}
              highlightRange={highlightRange}
              scopeToPeriod
            />
          </MapControlsDrawer>
        </>
      ) : (
        <TimelineControl
          stages={EXPLORATION_STAGES}
          periods={EXPLORATION_PERIODS}
          selected={state.stageName}
          onSelect={(stageName) => dispatch({ type: "selectStage", stageName })}
          onSelectPeriod={selectPeriod}
          highlightRange={highlightRange}
        />
      )}
      {/* SPEC-029 REQ-004: in present-day mode the coastline stops changing with
          the age, which is exactly the cue a reader uses to see that the
          timeline is still filtering. So the screen says it instead — otherwise
          a Maastrichtian-only scatter reads as the whole record. It sits under
          the timeline, in normal flow: inside the map pane it would be painted
          over by the map canvas, which is a positioning context. */}
      {state.frameMode === "present" && (
        <p className={styles.frameNote} role="status">
          Present-day coastlines. The selected age still chooses which
          occurrences are shown — {state.stageName} here.
        </p>
      )}
      <div
        className={styles.body}
        data-drawer-open={phoneLayout && drawerOpen ? "true" : undefined}
      >
        <div className={styles.mapPane} data-map-pane>
          {/* SPEC-023 REQ-002: app controls acting on what is plotted live in the
              bottom-right rail. The top-right corner is reserved for MapLibre's
              own controls, which is where this toggle used to collide with them.
              The top-left rail has no children since SPEC-021 removed the
              reconstruction label and the cluster note, so it does not render at
              all (REQ-001 — no empty box). */}
          {/* SPEC-023 AMEND-003: on a phone this control lives in the sheet
              instead, beside the unit selector it belongs with. */}
          {!phoneLayout && (
            <div
              className={`${styles.mapRail} ${styles.railBottomRight}`}
              data-map-rail="bottom-right"
            >
              {wikipediaGate}
            </div>
          )}
          {stageStatus.kind === "error" ? (
            <ErrorState
              message={stageStatus.message}
              onRetry={() => setStageAttempt((n) => n + 1)}
            />
          ) : stageStatus.kind === "loading" ? (
            <LoadingState label={`Loading ${state.stageName}…`} />
          ) : (
            <OccurrenceMap
              occurrences={unitOccurrences}
              selectedId={
                state.mode === "locality"
                  ? state.selectedLocalityId
                  : state.selectedOccurrenceId
              }
              onSelect={handleMapSelect}
              frameMode={state.frameMode}
              onPresentFrameAvailable={setPresentFrameAvailable}
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
              autoFit={phoneLayout}
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
        {/* SPEC-030 REQ-003/REQ-004: one set of contents, two containers. The
            sheet is the phone form of the SPEC-026 column, not a second surface
            — writing the column out twice would be the fastest way to let the
            two drift apart. */}
        {/* SPEC-030 AMEND-005: while the controls drawer is open the sheet
            stands down. At 320×568 the drawer leaves 132px below it, and a
            sheet clamped into 41px of that is a truncated grab handle over a
            sliver of map — two mushed surfaces where the reader asked for one
            control panel. The map keeps the whole remainder instead, so the
            age they are stepping is the thing they can see change. */}
        {phoneLayout && drawerOpen ? null : phoneLayout ? (
          <OccurrenceSheet
            label="Occurrence details"
            detailKey={detail ? (selectedKey ?? "detail") : null}
            // Only once the stage has actually resolved: `occurrences` is empty
            // during the first fetch too, and raising on that made the sheet
            // open at half on every load.
            raised={
              stageStatus.kind !== "loading" &&
              stageStatus.kind !== "error" &&
              occurrences.length === 0
            }
            summary={sheetSummary}
          >
            {columnContents}
          </OccurrenceSheet>
        ) : (
          <aside className={styles.sidebar} aria-label="Occurrence details">
            {columnContents}
          </aside>
        )}
      </div>
    </>,
    phoneLayout ? undefined : contextControls,
  );
}
