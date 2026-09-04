/**
 * Paleogeographic occurrence map (SPEC-003 REQ-002; SPEC-004; SPEC-002 REQ-004).
 * MapLibre GL renders a self-contained bathymetric basemap (no tiles, no token —
 * SEC-001): reconstructed continental land (SPEC-004) beneath the occurrences,
 * which are a clustered GeoJSON source at their reconstructed paleocoordinates.
 * Clusters carry size (group) and single points a marker (individual),
 * distinguished by shape + label, not colour alone (FONC-230/240, PERF-250).
 * Zoom/pan come from the built-in controls (FONC-250/260).
 *
 * The basemap is schematic and does not use the occurrences' rotation frame, so
 * the map discloses that source, rotation model + age, licence and any frame
 * mismatch (SPEC-004 REQ-002/003) through a compact, keyboard-operable attribution
 * control — an info button that opens the citation in a popover (mirroring
 * MapLibre's own collapsible AttributionControl), so the text can't overlap the
 * map. It renders even where WebGL is unavailable, which is also the accessible,
 * canvas-independent path (charter / SPEC-002 canvas-a11y edge case): where WebGL
 * is missing the map degrades to a note and the occurrence list remains the
 * equivalent route.
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type {
  Map as MapLibreMap,
  GeoJSONSource,
  MapMouseEvent,
} from "maplibre-gl";
import type { ReadOccurrence, ReadTaxon } from "../../domain/index.js";
import {
  describeFrame,
  loadBasemap,
  loadBasemapFrameIndex,
  selectFrame,
} from "../data/basemap.js";
import type { Basemap, BasemapFrameIndex } from "../data/basemap.js";
import {
  boundsOfPoints,
  fractionInView,
  framePoints,
} from "../state/viewport.js";
import type { Bounds } from "../state/viewport.js";
import type { GroupingMode, LocalityGroup } from "../state/grouping.js";
import {
  CLADE_MARKERS,
  FALLBACK_MARKER,
  cladeMarkerById,
  cladeMarkerForTaxon,
} from "./mapCladeMarkers.js";
import { pointIn, positionIn } from "../state/frame.js";
import type { FrameMode } from "../state/frame.js";
import {
  LAND_TEXTURE_ID,
  OCEAN_DEEP,
  buildEquator,
  buildGraticule,
  buildLandTexture,
  coastLayer,
  graticuleLayers,
  landLayers,
  oceanDepthLayers,
} from "./mapCartography.js";
import { MapHoverCard, hoverCardContent } from "./MapHoverCard.js";
import { MapSpeciesCard } from "./MapSpeciesCard.js";
import type { SpeciesRow } from "./MapSpeciesCard.js";
import { computeMapLabels } from "./mapLabels.js";
import type { LabelCandidate, MapLabel } from "./mapLabels.js";
import styles from "./exploration.module.css";

/** SPEC-015 REQ-002: name labels appear only once zoomed past this level. */
const LABEL_MIN_ZOOM = 5;
/** SPEC-015 AMEND-002 (#2): keep labels sparse/legible, Google-Maps-style. */
const MAX_LABELS = 10;

/**
 * SPEC-027 REQ-001 / OQ-003: how far the un-focused map recedes while a taxon is
 * focused. One constant for the clustered discs and the loose points alike, so
 * the whole base recedes by the same amount and the value is tunable in one
 * place.
 */
const DIM_OPACITY = 0.2;

/**
 * SPEC-027 REQ-003: framing a search result. The padding keeps the outermost
 * markers off the map edge; `maxZoom` stops a taxon known from a single locality
 * (a zero-area bounds) from diving to full zoom; the ease is short enough to
 * read as a move rather than a teleport.
 */
const FIT_PADDING = 64;
const FIT_MAX_ZOOM = 5.5;
const FIT_DURATION_MS = 700;
/**
 * SPEC-027 OQ-002: skip the move when the taxon is already substantially framed,
 * so searching something you are already looking at does not jolt the camera.
 */
const FIT_SKIP_THRESHOLD = 0.5;

/**
 * SPEC-027 AMEND-001. Stable identities for the optional collection props, and
 * value equality for the two DOM-overlay arrays.
 *
 * `updateOverlays` is called from effects *and* from map events, and it sets two
 * array states. Handing React a fresh array every time makes every call a
 * re-render; if an effect that calls it also depends on a prop whose default is
 * a fresh object, the two feed each other and the component never settles. The
 * frozen defaults remove that trigger for callers who omit the props; the
 * equality checks remove the state churn that powered the cycle, whoever calls.
 */
const NO_LOCALITIES: readonly LocalityGroup[] = Object.freeze([]);
const NO_OCCURRENCES: readonly ReadOccurrence[] = Object.freeze([]);
const NO_TAXA: ReadonlyMap<string, ReadTaxon> = new Map();
const EMPTY_LABELS: MapLabel[] = [];

export interface ClusterCount {
  key: string;
  x: number;
  y: number;
  count: number;
}

export function sameCounts(
  a: readonly ClusterCount[],
  b: readonly ClusterCount[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i] as ClusterCount;
    return x.key === y.key && x.count === y.count && x.x === y.x && x.y === y.y;
  });
}

export function sameLabels(
  a: readonly MapLabel[],
  b: readonly MapLabel[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i] as MapLabel;
    return x.id === y.id && x.x === y.x && x.y === y.y && x.taxon === y.taxon;
  });
}

/** Cluster disc radius for a given count (mirrors the map's `circle-radius` step). */
function clusterDiscRadius(count: number): number {
  if (count >= 200) return 28;
  if (count >= 50) return 22;
  if (count >= 10) return 17;
  return 13;
}

/**
 * The accessible name for a cluster badge (SPEC-021 REQ-001, restoring SPEC-010
 * REQ-002's original criterion). A cluster's number is a count of *records* at a
 * location — density — and never a count of distinct taxa; saying which unit is
 * counted is the whole point of the name, so the unit follows the mode. Locality
 * mode collapses collections, so it counts localities; every other mode plots one
 * feature per occurrence record.
 */
export function clusterCountLabel(count: number, mode: GroupingMode): string {
  if (mode === "locality") {
    return `${count} ${count === 1 ? "locality" : "localities"}`;
  }
  return `${count} occurrence record${count === 1 ? "" : "s"}`;
}

interface OccurrenceMapProps {
  occurrences: readonly ReadOccurrence[];
  selectedId: string | null;
  onSelect: (featureId: string) => void;
  /** The occurrences' pinned rotation model, for basemap frame reconciliation. */
  occurrenceRotationModel: string;
  /** Selected stage — selects the time-varying basemap frame (SPEC-008 REQ-004). */
  stageName: string;
  /**
   * Which frame the map draws (SPEC-029 REQ-002). Defaults to the
   * paleogeographic one, so every existing caller and test is unaffected.
   */
  frameMode?: FrameMode;
  /**
   * Reports whether the basemap index carries a present-day frame, once it
   * resolves (SPEC-029 UX-002). The map is the one place that loads the index,
   * so the shell learns it from here rather than fetching the file twice.
   */
  onPresentFrameAvailable?: (available: boolean) => void;
  /** Reports the map's current bounds on load and on pan/zoom (SPEC-005 REQ-002). */
  onViewportChange?: (bounds: Bounds) => void;
  /** Transiently highlighted feature, mirrored with the list (SPEC-009 REQ-004). */
  highlightedId?: string | null;
  /** Reports the feature under the pointer (or null), for list cross-highlight. */
  onHover?: (featureId: string | null) => void;
  /** Grouping unit: occurrence/taxon plot occurrences; locality plots collections (SPEC-010). */
  mode?: GroupingMode;
  /** Locality features for locality mode (one marker per collection, REQ-003). */
  localities?: readonly LocalityGroup[];
  /**
   * Taxon focus (SPEC-010 REQ-004): the selected taxon's occurrence ids. When
   * non-empty the map emphasises these points and dims the rest — no hue identity.
   */
  focusIds?: readonly string[] | null;
  /**
   * The focused occurrences themselves (SPEC-027 REQ-003), for framing the
   * camera on a search landing. Same set as `focusIds`, resolved to records so
   * the map can read their paleocoordinates without a lookup.
   */
  focusOccurrences?: readonly ReadOccurrence[];
  /**
   * Frame the focus when this changes (SPEC-027 REQ-003). Bumped **only** by a
   * search landing, so a list selection or a map click never moves the camera.
   * The fit is deferred until the focus is actually populated, because the
   * landed stage's occurrences may still be loading.
   */
  fitToken?: number;
  /**
   * Frame the camera on the stage's occurrences once, on first paint.
   *
   * The map opens at a fixed `center`/`zoom` chosen for a wide desktop pane. On
   * a 390×470 portrait pane the same camera crops elsewhere: the markers crowd
   * the left edge and the right half is empty ocean. Set on the phone layout
   * only, so the desktop's opening view is byte-identical (SPEC-030 NFR-002).
   */
  autoFit?: boolean;
  /**
   * Select a taxon from the cluster aggregate card (SPEC-027 REQ-005). Provided
   * only in taxon mode; when present, picking a species selects it on the map
   * instead of leaving for its profile.
   */
  onSelectTaxon?: ((taxonId: string) => void) | undefined;
  /**
   * Reference taxa (SPEC-015): used to resolve each occurrence's clade marker
   * (icon + tint) and label. Occurrence/taxon modes render clade silhouettes.
   */
  taxaById?: ReadonlyMap<string, ReadTaxon>;
  /**
   * Open a taxon's page (SPEC-015 AMEND-001): the pinned marker card's primary
   * action. When omitted, the card shows no "Open taxon profile" button.
   */
  onOpenProfile?: (taxonId: string) => void;
}

const ACCENT_DEEP = "#0a7f66";

/**
 * Paint expressions for the individual-point layer given the current selection and
 * highlight (SPEC-009 REQ-004). Selection is the strongest emphasis, highlight a
 * weaker one; both darken the ring so they read without colour alone (PERF-250).
 */
function pointStrokeWidth(
  selectedId: string | null,
  highlightedId: string | null,
): unknown {
  return [
    "case",
    ["==", ["get", "id"], selectedId ?? ""],
    3,
    ["==", ["get", "id"], highlightedId ?? ""],
    2.5,
    // SPEC-018 REQ-004: the resting casing widened from 1.5 to 2. The background
    // is no longer one flat value, so a marker now has to separate itself from
    // the shelf, the slope, the deep water *and* the land it may sit on. The
    // selected > highlighted > resting ordering (SPEC-009 REQ-004) is preserved.
    2,
  ];
}

function pointStrokeColor(
  selectedId: string | null,
  highlightedId: string | null,
): unknown {
  return [
    "case",
    ["==", ["get", "id"], selectedId ?? ""],
    ACCENT_DEEP,
    ["==", ["get", "id"], highlightedId ?? ""],
    ACCENT_DEEP,
    "#ffffff",
  ];
}

/**
 * Self-contained style — background only, no external tiles/glyphs (SEC-001).
 * The background is the **deep** water value; the shelf and slope bands above it
 * are derived from the coastline at frame time (SPEC-018 REQ-001).
 */
const BASE_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "ocean",
      type: "background" as const,
      paint: { "background-color": OCEAN_DEEP },
    },
  ],
};

/**
 * SPEC-015 NFR-002. The clade artwork is ~1254 px square, but the app never draws
 * it larger than the taxon profile's 220 px panel — the map draws it at 22–40 px.
 * The size is split across two stages, and their product is what every `icon-size`
 * below is multiplied by, so markers render at exactly the size SPEC-015 tuned:
 *
 * - `ICON_ASSET_DOWNSCALE` is already baked into the committed PNGs
 *   (`scripts/shrink_clade_icons.ts`, which also pre-strips the white background),
 *   cutting 5.7 MB of shipped assets to 0.37 MB.
 * - `ICON_ATLAS_DOWNSCALE` is applied here, when registering the icons. MapLibre
 *   packs registered images into a **per-tile** atlas at the image's *native*
 *   size, so a full-resolution raster costs ~35 MB of atlas texture per tile,
 *   re-uploaded as tiles load while panning. ~125 px still supersamples a 40 px
 *   marker on a 2x display, so the silhouettes stay crisp.
 *
 * Both stages divide every asset by the same factor, so the icons keep their
 * relative proportions.
 */
const ICON_ASSET_DOWNSCALE = 3;
const ICON_SIZE_SCALE = 10;
const ICON_ATLAS_DOWNSCALE = ICON_SIZE_SCALE / ICON_ASSET_DOWNSCALE;

/**
 * SPEC-015 REQ-001 (#4): load a bundled clade silhouette for the map's icon atlas.
 * The committed PNG is already background-stripped, so this only has to downscale
 * it to its atlas size (NFR-002). Self-contained — the asset is bundled, so there
 * is no egress. Returns a MapLibre-addable RGBA image.
 */
async function loadIconImage(
  src: string,
  downscale: number,
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
  const width = Math.max(
    1,
    Math.round((img.naturalWidth || img.width) / downscale),
  );
  const height = Math.max(
    1,
    Math.round((img.naturalHeight || img.height) / downscale),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

function toFeatureCollection(
  occurrences: readonly ReadOccurrence[],
  taxaById: ReadonlyMap<string, ReadTaxon>,
  mode: FrameMode,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const o of occurrences) {
    // SPEC-029 REQ-003: the active frame decides the coordinate, and the same
    // accessor decides it everywhere — so the points cannot end up in a
    // different frame from the coastline under them.
    const at = positionIn(o, mode);
    if (!at) continue; // no position in this frame → not placeable
    // SPEC-015: resolve the clade marker (icon + tint) for data-driven paint.
    const marker = cladeMarkerForTaxon(o.taxonId, taxaById);
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [at.lng, at.lat],
      },
      properties: {
        id: o.id,
        taxonId: o.taxonId,
        taxon: o.taxonName,
        iconKey: marker.id,
        tint: marker.tint,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** One marker per collection at its own paleocoordinate (SPEC-010 REQ-003). */
function toLocalityFeatureCollection(
  localities: readonly LocalityGroup[],
  mode: FrameMode,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const g of localities) {
    const at = pointIn(g.paleo, g.modern, mode);
    if (!at) continue; // no position in this frame → not placeable
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [at.lng, at.lat],
      },
      properties: { id: g.collectionId, taxonCount: g.taxonCount },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Choose the source features for the active mode (SPEC-010 REQ-002/003/004). */
function featuresForMode(
  mode: GroupingMode,
  occurrences: readonly ReadOccurrence[],
  localities: readonly LocalityGroup[],
  taxaById: ReadonlyMap<string, ReadTaxon>,
  frameMode: FrameMode,
): GeoJSON.FeatureCollection {
  return mode === "locality"
    ? toLocalityFeatureCollection(localities, frameMode)
    : toFeatureCollection(occurrences, taxaById, frameMode);
}

/**
 * Base-layer opacity while a taxon is focused (SPEC-010 REQ-004, SPEC-027
 * REQ-001). The whole base recedes — clustered discs included — because the
 * focused occurrences are re-drawn at full strength by the emphasis overlay
 * above it. Emphasis, not hue. No focus → everything opaque.
 *
 * Note the change from a per-feature `case` to a flat value: the overlay now
 * carries the focused points, so the base layers no longer need to single any
 * feature out, and clusters (which have no `id`) dim by exactly the same rule.
 */
function baseOpacity(focusIds: readonly string[] | null | undefined): number {
  return !focusIds || focusIds.length === 0 ? 1 : DIM_OPACITY;
}

/**
 * The emphasis overlay's features (SPEC-027 REQ-001): the focused taxon's
 * occurrences, plus the selected and hovered feature, drawn **unclustered**
 * above everything else.
 *
 * This is what makes a selection legible. The base source clusters at
 * `clusterRadius` 28 from zoom 2.2, so at the zoom the app opens at, the great
 * majority of a stage's 5k–9k occurrences are inside a disc: painting emphasis
 * on the unclustered layers alone left the selection invisible. Exempting just
 * the emphasised features from clustering costs one small source and no
 * re-clustering of the base (NFR-001).
 */
function emphasisFeatures(
  all: GeoJSON.FeatureCollection,
  focusIds: readonly string[] | null | undefined,
  selectedId: string | null,
  highlightedId: string | null,
): GeoJSON.FeatureCollection {
  const ids = new Set<string>(focusIds ?? []);
  if (selectedId) ids.add(selectedId);
  if (highlightedId) ids.add(highlightedId);
  if (ids.size === 0) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: all.features.filter((f) => {
      const id = f.properties?.["id"];
      return typeof id === "string" && ids.has(id);
    }),
  };
}

export function OccurrenceMap({
  occurrences,
  selectedId,
  onSelect,
  occurrenceRotationModel,
  stageName,
  frameMode = "paleo",
  onPresentFrameAvailable,
  onViewportChange,
  highlightedId = null,
  onHover,
  mode = "occurrence",
  localities = NO_LOCALITIES,
  focusIds = null,
  focusOccurrences = NO_OCCURRENCES,
  fitToken = 0,
  autoFit = false,
  taxaById = NO_TAXA,
  onOpenProfile,
  onSelectTaxon,
}: OccurrenceMapProps): ReactElement {
  const onOpenProfileRef = useRef(onOpenProfile);
  onOpenProfileRef.current = onOpenProfile;
  const onSelectTaxonRef = useRef(onSelectTaxon);
  onSelectTaxonRef.current = onSelectTaxon;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  // SPEC-015: latest occurrences + mode for the map's own event handlers, which
  // close over the initial render (overlay reprojection + mode gating).
  const occurrencesRef = useRef(occurrences);
  occurrencesRef.current = occurrences;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // SPEC-027 REQ-008: the focus set, as a Set, for the label pass.
  const focusIdsRef = useRef<ReadonlySet<string>>(new Set());
  focusIdsRef.current = new Set(focusIds ?? []);

  // Transient hover preview, the pinned (clicked) interactive card, the culled
  // labels, and the cluster count badges.
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [pinned, setPinned] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  // The multi-species aggregate card (AMEND-002 #3): raw leaf rows + a geographic
  // anchor so it can follow the map; presentational fields are resolved in render.
  const [multi, setMulti] = useState<{
    lng: number;
    lat: number;
    x: number;
    y: number;
    rows: Array<{ taxonId: string; taxon: string; iconKey: string }>;
  } | null>(null);
  const multiRef = useRef(multi);
  multiRef.current = multi;
  const [labels, setLabels] = useState<MapLabel[]>([]);
  // SPEC-023 UX-001 as amended by SPEC-030 (AMEND-001, owner decision
  // 2026-09-02): open by default above the 40rem breakpoint, **collapsed** below
  // it — expanded the key is 183 × 193px, 26% of the map at 320px. Remembered
  // for the session only, no storage, and one tap from expanded either way.
  //
  // Read once at mount rather than tracked: a viewport crossing the breakpoint
  // mid-session must not yank the key shut under a reader who just opened it,
  // which is the "collapse is a user action" half of UX-001 that survives.
  const [cladeKeyOpen, setCladeKeyOpen] = useState(
    () =>
      !(
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 40rem)").matches
      ),
  );
  const [clusterCounts, setClusterCounts] = useState<
    Array<{ key: string; x: number; y: number; count: number }>
  >([]);

  // SPEC-015 REQ-002/REQ-004: recompute every DOM overlay from what the map is
  // actually rendering — labels sit only on unclustered markers, cluster counts
  // track clusters, and the pinned card follows its marker. Cheap enough to run
  // continuously during pan/zoom (the caller rAF-throttles it, #2).
  const updateOverlays = (): void => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("points-icon")) return;

    // Cluster count badges (from the rendered cluster circles).
    const counts: Array<{ key: string; x: number; y: number; count: number }> =
      [];
    if (map.getLayer("clusters")) {
      const seenC = new Set<string>();
      for (const f of map.queryRenderedFeatures({ layers: ["clusters"] })) {
        const n = f.properties?.["point_count"];
        if (typeof n !== "number" || f.geometry.type !== "Point") continue;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        const key = String(f.properties?.["cluster_id"] ?? `${lng},${lat}`);
        if (seenC.has(key)) continue;
        seenC.add(key);
        const p = map.project([lng, lat]);
        counts.push({ key, x: p.x, y: p.y, count: n });
      }
    }
    // SPEC-027 AMEND-001: keep the previous array when nothing actually moved.
    // `updateOverlays` runs from effects as well as map events, and a fresh array
    // identity here forces a re-render — which re-runs those effects, which calls
    // this again. Bailing on an unchanged value breaks that cycle at its source
    // and also spares a render per settled pan frame.
    setClusterCounts((prev) => (sameCounts(prev, counts) ? prev : counts));

    // Keep the pinned card anchored to its marker as the map moves.
    const pin = pinnedRef.current;
    if (pin) {
      const o = occurrencesRef.current.find((x) => x.id === pin.id);
      const at = o ? positionIn(o, frameModeRef.current) : null;
      if (at) {
        const p = map.project([at.lng, at.lat]);
        if (p.x !== pin.x || p.y !== pin.y) {
          setPinned({ id: pin.id, x: p.x, y: p.y });
        }
      }
    }
    // Keep the multi-species card anchored to its aggregate as the map moves.
    const m = multiRef.current;
    if (m) {
      const p = map.project([m.lng, m.lat]);
      if (p.x !== m.x || p.y !== m.y) setMulti({ ...m, x: p.x, y: p.y });
    }

    // Name labels — unclustered markers only, zoom-gated, collision-culled.
    if (modeRef.current === "locality" || map.getZoom() < LABEL_MIN_ZOOM) {
      setLabels((prev) => (prev.length === 0 ? prev : EMPTY_LABELS));
      return;
    }
    const seen = new Set<string>();
    const candidates: LabelCandidate[] = [];
    // SPEC-027 REQ-008: read the emphasis overlay too, and mark its markers, so
    // the focused taxon gets named rather than losing every label to the dimmed
    // markers around it.
    const focusSet = focusIdsRef.current;
    const layers = ["emphasis-icon", "points-icon"].filter((l) =>
      map.getLayer(l),
    );
    for (const f of map.queryRenderedFeatures({ layers })) {
      const id = f.properties?.["id"];
      const taxon = f.properties?.["taxon"];
      if (typeof id !== "string" || typeof taxon !== "string" || seen.has(id)) {
        continue;
      }
      if (f.geometry.type !== "Point") continue;
      seen.add(id);
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const p = map.project([lng, lat]);
      candidates.push({ id, taxon, x: p.x, y: p.y, focused: focusSet.has(id) });
    }
    const next = computeMapLabels(candidates, { maxLabels: MAX_LABELS });
    setLabels((prev) => (sameLabels(prev, next) ? prev : next));
  };
  const updateOverlaysRef = useRef(updateOverlays);
  updateOverlaysRef.current = updateOverlays;
  // rAF-throttled scheduler for the continuous `move` handler (#2: no lag).
  const rafRef = useRef<number | null>(null);
  const scheduleOverlayUpdate = (): void => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateOverlaysRef.current();
    });
  };
  const scheduleOverlayUpdateRef = useRef(scheduleOverlayUpdate);
  scheduleOverlayUpdateRef.current = scheduleOverlayUpdate;
  const [available, setAvailable] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  const [frameExact, setFrameExact] = useState(true);
  const [frameIndex, setFrameIndex] = useState<BasemapFrameIndex | null>(null);
  // The move handler runs outside render, so it reads the frame from a ref for
  // the same reason it reads the occurrences from one.
  const frameModeRef = useRef(frameMode);
  frameModeRef.current = frameMode;
  // Basemap provenance is disclosed via a compact info button so its text can't
  // overlap the map; the details open in a popover anchored above the button.
  const [attributionOpen, setAttributionOpen] = useState(false);

  // Load the per-stage frame index once (independent of WebGL). Failure leaves it
  // null → the effect below degrades to the graticule (SPEC-004/008 REQ-004).
  useEffect(() => {
    let cancelled = false;
    void loadBasemapFrameIndex().then((idx) => {
      if (cancelled) return;
      setFrameIndex(idx);
      onPresentFrameAvailable?.(Boolean(idx?.present));
    });
    return () => {
      cancelled = true;
    };
    // Runs once: the index is immutable for the session, and re-running on a new
    // callback identity would refetch it on every render of the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Select and load the frame for the current stage; reload when the stage
  // changes so the coastlines are time-varying (SPEC-008 REQ-004). Falls back to
  // the nearest available frame (disclosed) or the graticule.
  useEffect(() => {
    let cancelled = false;
    if (!frameIndex) {
      setBasemap(null);
      return;
    }
    // SPEC-029 REQ-002: present-day mode draws the 0 Ma frame at every age, so
    // it does not consult `selectFrame` — the present frame is deliberately not
    // in the list that function searches (REQ-001).
    const chosen =
      frameMode === "present"
        ? frameIndex.present
          ? { frame: frameIndex.present, exact: true }
          : null
        : selectFrame(stageName, frameIndex.frames);
    if (!chosen) {
      setBasemap(null);
      return;
    }
    setFrameExact(chosen.exact);
    void loadBasemap(chosen.frame.geojsonUrl, chosen.frame.metaUrl).then(
      (b) => {
        if (!cancelled) setBasemap(b);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [frameIndex, stageName, frameMode]);

  // Initialise the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let gl: RenderingContext | null = null;
    try {
      const canvas = document.createElement("canvas");
      gl =
        canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    } catch {
      gl = null;
    }
    if (!gl) {
      setAvailable(false);
      return;
    }

    let cancelled = false;
    let cleanup = (): void => {};
    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled) return;
        const map = new maplibre.Map({
          container,
          style: BASE_STYLE as never,
          center: [-75, 55],
          zoom: 2.2,
          attributionControl: false,
        });
        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        mapRef.current = map;
        // Dev-only debug hook (stripped from production builds) — lets tooling
        // drive the map deterministically.
        // `import.meta.env.DEV` must be referenced inline: Vite replaces that
        // exact expression at build time, so binding `import.meta` to a variable
        // first leaves `meta.env` undefined and the hook never installs.
        if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
          (window as unknown as { __paleoMap?: MapLibreMap }).__paleoMap = map;
        }
        cleanup = (): void => {
          loadedRef.current = false;
          mapRef.current = null;
          setMapLoaded(false);
          if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
          map.remove();
        };
        map.on("load", () => {
          void (async () => {
            // SPEC-015 REQ-001 (#4): register the bounded clade icon set once,
            // with the opaque white background stripped to transparency (bundled
            // assets — no egress). Guarded so a re-init never double-adds.
            await Promise.all(
              CLADE_MARKERS.map(async (m) => {
                if (map.hasImage(m.id)) return;
                try {
                  const icon = await loadIconImage(m.src, ICON_ATLAS_DOWNSCALE);
                  if (!map.hasImage(m.id)) map.addImage(m.id, icon);
                } catch {
                  /* a missing icon just falls back to the tinted disc */
                }
              }),
            );
            if (cancelled || !mapRef.current) return;

            // SPEC-018 AMEND-001: the land stipple. Registered before any layer
            // references it, and as a Uint8ClampedArray — a plain Uint8Array is
            // accepted by addImage but never renders as a fill-pattern.
            if (!map.hasImage(LAND_TEXTURE_ID)) {
              map.addImage(LAND_TEXTURE_ID, buildLandTexture());
            }

            // SPEC-018 REQ-003: the graticule is **frame-independent**, so it is
            // added at load rather than with the basemap. That is what keeps it
            // rendering in the no-frame fallback the map already degrades to.
            // Added before the occurrence layers below, so it can never obscure a
            // marker; `land-line` is later inserted above it so it can never
            // obscure a coastline either.
            map.addSource("graticule", {
              type: "geojson",
              data: buildGraticule(),
            });
            map.addSource("equator", { type: "geojson", data: buildEquator() });
            for (const layer of graticuleLayers("graticule", "equator")) {
              map.addLayer(layer as never);
            }

            map.addSource("occurrences", {
              type: "geojson",
              data: featuresForMode(
                mode,
                occurrences,
                localities,
                taxaById,
                frameMode,
              ),
              cluster: true,
              // Decluster sooner (SPEC-015): a smaller radius + a max-zoom cap
              // surface individual clade icons earlier and stop clustering once
              // zoomed in, so labels sit on real markers, not clusters.
              clusterRadius: 28,
              // Distinct points separate as you zoom; occurrences at the *same*
              // place never do — so co-located ones stay one aggregate marker
              // (AMEND-002 #3) rather than an illegible overlapping pile.
              clusterMaxZoom: 14,
            });
            // SPEC-015 AMEND-001 (#1): a cluster is a pale disc (sized by count)
            // carrying the generic dinosaur silhouette + a DOM count badge — so an
            // aggregate reads as "many dinosaurs here (N)", not an anonymous dot.
            map.addLayer({
              id: "clusters",
              type: "circle",
              source: "occurrences",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": "#dbe3e7",
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  13,
                  10,
                  17,
                  50,
                  22,
                  200,
                  28,
                ],
                "circle-stroke-color": "#ffffff",
                // SPEC-018 REQ-004: widened with the point casing above — the
                // pale cluster disc sits close in value to the new slope band,
                // so the white casing is what keeps it legible over water.
                "circle-stroke-width": 2,
                // SPEC-027 REQ-001: the discs recede with the rest of the base
                // while a taxon is focused, so the overlay above reads clearly.
                "circle-opacity": baseOpacity(focusIds),
                "circle-stroke-opacity": baseOpacity(focusIds),
              },
            });
            map.addLayer({
              id: "clusters-icon",
              type: "symbol",
              source: "occurrences",
              filter: ["has", "point_count"],
              layout: {
                "icon-image": FALLBACK_MARKER.id,
                // Design values scaled by ICON_SIZE_SCALE, because the
                // registered raster is that much smaller (NFR-002).
                "icon-size": [
                  "step",
                  ["get", "point_count"],
                  0.014 * ICON_SIZE_SCALE,
                  50,
                  0.02 * ICON_SIZE_SCALE,
                  200,
                  0.026 * ICON_SIZE_SCALE,
                ] as never,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                // SPEC-027 REQ-006: a locality cluster aggregates collections,
                // not animals, so it must not wear a clade silhouette.
                visibility: mode === "locality" ? "none" : "visible",
              },
              paint: { "icon-opacity": baseOpacity(focusIds) },
            });
            // SPEC-015 REQ-001: a tinted clade "coin" (the meaning-only tint)
            // that frames the silhouette; also the selection/highlight ring
            // (SPEC-009 REQ-004, carried by the stroke).
            const coinRadius = [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              12,
              6,
              20,
            ];
            map.addLayer({
              id: "points-bg",
              type: "circle",
              source: "occurrences",
              filter: ["!", ["has", "point_count"]],
              paint: {
                "circle-color": ["get", "tint"] as never,
                "circle-radius": coinRadius as never,
                "circle-stroke-color": pointStrokeColor(
                  selectedId,
                  highlightedId,
                ) as never,
                "circle-stroke-width": pointStrokeWidth(
                  selectedId,
                  highlightedId,
                ) as never,
                "circle-opacity": baseOpacity(focusIds),
                "circle-stroke-opacity": baseOpacity(focusIds),
              },
            });
            // SPEC-015 REQ-001: the clade silhouette (transparent), sitting on the
            // tinted coin so shape + tint read together.
            map.addLayer({
              id: "points-icon",
              type: "symbol",
              source: "occurrences",
              filter: ["!", ["has", "point_count"]],
              layout: {
                "icon-image": ["get", "iconKey"] as never,
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  2,
                  0.018 * ICON_SIZE_SCALE,
                  6,
                  0.032 * ICON_SIZE_SCALE,
                ] as never,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
              paint: { "icon-opacity": baseOpacity(focusIds) },
            });

            // SPEC-027 REQ-001: the emphasis overlay — an **unclustered** source
            // holding only the focused / selected / highlighted occurrences,
            // drawn above everything. Clustering can no longer swallow a
            // selection: whatever is emphasised is always its own marker, at any
            // zoom, at full strength over the receded base.
            const emphasis = emphasisFeatures(
              featuresForMode(
                mode,
                occurrences,
                localities,
                taxaById,
                frameMode,
              ),
              focusIds,
              selectedId,
              highlightedId,
            );
            map.addSource("emphasis", {
              type: "geojson",
              data: emphasis,
              cluster: false,
            });
            map.addLayer({
              id: "emphasis-bg",
              type: "circle",
              source: "emphasis",
              paint: {
                // Locality features carry no clade tint; fall back to the accent.
                "circle-color": [
                  "coalesce",
                  ["get", "tint"],
                  ACCENT_DEEP,
                ] as never,
                "circle-radius": coinRadius as never,
                "circle-stroke-color": pointStrokeColor(
                  selectedId,
                  highlightedId,
                ) as never,
                "circle-stroke-width": pointStrokeWidth(
                  selectedId,
                  highlightedId,
                ) as never,
              },
            });
            map.addLayer({
              id: "emphasis-icon",
              type: "symbol",
              source: "emphasis",
              // Locality features have no clade icon — the disc alone carries them.
              filter: ["has", "iconKey"],
              layout: {
                "icon-image": ["get", "iconKey"] as never,
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  2,
                  0.018 * ICON_SIZE_SCALE,
                  6,
                  0.032 * ICON_SIZE_SCALE,
                ] as never,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
            });

            loadedRef.current = true;
            setMapLoaded(true);

            const reportBounds = (): void => {
              const b = map.getBounds();
              onViewportChangeRef.current?.({
                west: b.getWest(),
                south: b.getSouth(),
                east: b.getEast(),
                north: b.getNorth(),
              });
            };
            reportBounds(); // initial extent
            // #2: overlays follow the map continuously (rAF-throttled), and settle
            // on moveend (which also reports the viewport, SPEC-005 REQ-002).
            map.on("move", () => scheduleOverlayUpdateRef.current());
            map.on("moveend", () => {
              reportBounds();
              updateOverlaysRef.current();
            });
            map.on("movestart", () => {
              setHover(null);
              onHoverRef.current?.(null);
            });

            // SPEC-015 AMEND-001 (#3): one click handler. On a marker → pin the
            // interactive card (and sync the list). On a cluster → zoom in. On
            // empty map → dismiss the pinned card.
            map.on("click", (e: MapMouseEvent) => {
              // The emphasis overlay sits on top, so it is hit-tested first —
              // a focused marker must stay clickable where it covers the base.
              const pf = map.queryRenderedFeatures(e.point, {
                layers: [
                  "emphasis-bg",
                  "emphasis-icon",
                  "points-bg",
                  "points-icon",
                ].filter((l) => map.getLayer(l)),
              });
              const pid = pf[0]?.properties?.["id"];
              if (typeof pid === "string") {
                setMulti(null);
                setPinned({ id: pid, x: e.point.x, y: e.point.y });
                onSelectRef.current(pid);
                return;
              }
              const cf = map.queryRenderedFeatures(e.point, {
                layers: ["clusters"],
              });
              const cprops = cf[0]?.properties;
              const cg = cf[0]?.geometry;
              if (!cprops || !cg || cg.type !== "Point") {
                setPinned(null);
                setMulti(null);
                return;
              }
              const center = cg.coordinates as [number, number];
              const clusterId = cprops["cluster_id"];
              const count = (cprops["point_count"] as number) ?? 0;
              const source = map.getSource("occurrences") as GeoJSONSource;
              const zoomIn = (): void => {
                map.easeTo({ center, zoom: map.getZoom() + 2 });
              };
              // SPEC-027 REQ-005/006: the species card is a taxonomic device, so
              // it has no business in locality mode — those leaves are
              // collections and carry no taxon at all, which used to strand an
              // empty, invisible card that suppressed hover. There, a cluster
              // click simply zooms.
              if (modeRef.current === "locality") {
                zoomIn();
                return;
              }
              // AMEND-002 #3: if zooming can't separate the leaves (they're at the
              // same place) or we're deep in, list every species here; else zoom.
              if (typeof clusterId !== "number" || !source.getClusterLeaves) {
                zoomIn();
                return;
              }
              void source
                .getClusterLeaves(clusterId, Math.min(count, 60), 0)
                .then((leaves) => {
                  let minLng = Infinity,
                    maxLng = -Infinity,
                    minLat = Infinity,
                    maxLat = -Infinity;
                  const byTaxon = new Map<
                    string,
                    { taxonId: string; taxon: string; iconKey: string }
                  >();
                  for (const l of leaves) {
                    if (l.geometry.type !== "Point") continue;
                    const [lng, lat] = l.geometry.coordinates as [
                      number,
                      number,
                    ];
                    minLng = Math.min(minLng, lng);
                    maxLng = Math.max(maxLng, lng);
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                    const tid = l.properties?.["taxonId"];
                    if (typeof tid === "string" && !byTaxon.has(tid)) {
                      byTaxon.set(tid, {
                        taxonId: tid,
                        taxon: String(l.properties?.["taxon"] ?? tid),
                        iconKey: String(l.properties?.["iconKey"] ?? "other"),
                      });
                    }
                  }
                  // Show the species list for a small "multidot" aggregate, or
                  // when zooming can't separate the leaves (coincident / deep in);
                  // otherwise a big dense cluster zooms in (AMEND-002 #3).
                  const spread = Math.max(maxLng - minLng, maxLat - minLat);
                  const small = byTaxon.size <= 15;
                  if (small || spread < 1e-3 || map.getZoom() >= 13) {
                    const p = map.project(center);
                    setPinned(null);
                    setMulti({
                      lng: center[0],
                      lat: center[1],
                      x: p.x,
                      y: p.y,
                      rows: [...byTaxon.values()],
                    });
                  } else {
                    zoomIn();
                  }
                })
                .catch(() => zoomIn());
            });

            // SPEC-015 REQ-003 + SPEC-009 REQ-004: hover drives the transient
            // preview card + the list cross-highlight. Suppressed while a card is
            // pinned so the two don't fight.
            map.on("mousemove", (e: MapMouseEvent) => {
              const feats = map.queryRenderedFeatures(e.point, {
                layers: ["points-bg", "points-icon", "clusters"],
              });
              const top = feats[0];
              const id = top?.properties?.["id"];
              const isCluster = top?.properties?.["point_count"] != null;
              map.getCanvas().style.cursor = top ? "pointer" : "";
              if (pinnedRef.current || multiRef.current) return;
              if (typeof id === "string" && !isCluster) {
                setHover({ id, x: e.point.x, y: e.point.y });
                onHoverRef.current?.(id);
              } else {
                setHover(null);
                onHoverRef.current?.(null);
              }
            });
            map.on("mouseout", () => {
              setHover(null);
              onHoverRef.current?.(null);
            });
            updateOverlaysRef.current();
          })();
        });
      } catch {
        setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // Initialise once; data/selection/basemap are synced by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add the reconstructed continental land beneath the markers once both the map
  // and the basemap are ready (SPEC-004 REQ-001). Drawn before 'clusters' so
  // markers stay on top and selectable.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !basemap) return;
    const existing = map.getSource("basemap") as GeoJSONSource | undefined;
    if (existing) {
      // Time-varying frame: swap the coastlines when the stage changes (REQ-004).
      existing.setData(basemap.geojson);
      return;
    }
    map.addSource("basemap", { type: "geojson", data: basemap.geojson });

    // SPEC-018 REQ-001/002. Stacking, bottom to top: the two blurred depth bands,
    // then the land fill painted over their landward halves, then the land
    // relief. All of these go *below* the graticule; only `land-line` goes above
    // it, so the coastline always stays crisp (REQ-003).
    //
    // Each `addLayer(..., beforeId)` inserts immediately below `beforeId`, so
    // insertion order here is the stacking order — see CARTOGRAPHY_LAYER_ORDER.
    for (const layer of [
      ...oceanDepthLayers("basemap"),
      ...landLayers("basemap", LAND_TEXTURE_ID),
    ]) {
      map.addLayer(layer as never, "graticule");
    }
    map.addLayer(coastLayer("basemap") as never, "clusters");
  }, [mapLoaded, basemap]);

  // Sync source data when the visible occurrences, mode, or localities change
  // (PERF-360; SPEC-010 REQ-002/003).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource("occurrences") as GeoJSONSource | undefined;
    source?.setData(
      featuresForMode(mode, occurrences, localities, taxaById, frameMode),
    );
    updateOverlaysRef.current();
    // `frameMode` belongs here: toggling the frame re-projects the points from
    // data already loaded, which is the whole behaviour (SPEC-029 NFR-003).
  }, [occurrences, localities, mode, taxaById, frameMode]);

  // Sync the emphasis overlay + the base dim (SPEC-010 REQ-004, SPEC-027
  // REQ-001). Note what this effect does *not* do: it never re-feeds the
  // clustered `occurrences` source, so selecting a taxon costs one small
  // setData on the overlay rather than re-clustering 5k–9k points (NFR-001).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getSource("emphasis")) return;
    const source = map.getSource("emphasis") as GeoJSONSource;
    source.setData(
      emphasisFeatures(
        featuresForMode(mode, occurrences, localities, taxaById, frameMode),
        focusIds,
        selectedId,
        highlightedId,
      ),
    );
    const dim = baseOpacity(focusIds);
    const setIf = (layer: string, prop: string, value: unknown): void => {
      if (map.getLayer(layer))
        map.setPaintProperty(layer, prop, value as never);
    };
    setIf("clusters", "circle-opacity", dim);
    setIf("clusters", "circle-stroke-opacity", dim);
    setIf("clusters-icon", "icon-opacity", dim);
    setIf("points-bg", "circle-opacity", dim);
    setIf("points-bg", "circle-stroke-opacity", dim);
    setIf("points-icon", "icon-opacity", dim);
    // The emphasis overlay carries its own copy of the focused points, so it
    // has to be rebuilt in the new frame too (SPEC-029 REQ-003).
  }, [
    focusIds,
    selectedId,
    highlightedId,
    mode,
    occurrences,
    localities,
    taxaById,
    frameMode,
  ]);

  // Sync the selected- and highlighted-point emphasis (SPEC-009 REQ-004). The
  // ring is carried by both the base points and the overlay, so an emphasised
  // occurrence reads the same whether or not it is also inside a cluster.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("points-bg")) return;
    // The coin radius is fixed (by zoom); selection/highlight is shown by the
    // ring stroke only, so the marker size stays stable (SPEC-009 REQ-004).
    for (const layer of ["points-bg", "emphasis-bg"]) {
      if (!map.getLayer(layer)) continue;
      map.setPaintProperty(
        layer,
        "circle-stroke-width",
        pointStrokeWidth(selectedId, highlightedId) as never,
      );
      map.setPaintProperty(
        layer,
        "circle-stroke-color",
        pointStrokeColor(selectedId, highlightedId) as never,
      );
    }
  }, [selectedId, highlightedId]);

  // SPEC-027 REQ-006: a locality cluster must not wear a clade silhouette.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("clusters-icon")) return;
    map.setLayoutProperty(
      "clusters-icon",
      "visibility",
      mode === "locality" ? "none" : "visible",
    );
  }, [mode]);

  // SPEC-027 REQ-003: frame a search landing — once per token, and only once the
  // focus is populated (the landed stage may still have been loading when the
  // token was bumped). Skipped when the taxon is already substantially in view,
  // so searching what you are looking at does not jolt the camera (OQ-002).
  const fittedTokenRef = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (fitToken === fittedTokenRef.current) return;
    const points = framePoints(focusOccurrences, frameMode);
    if (points.length === 0) return; // wait for the stage's occurrences
    fittedTokenRef.current = fitToken;
    const b = map.getBounds();
    const current: Bounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };
    if (fractionInView(points, current) >= FIT_SKIP_THRESHOLD) return;
    const target = boundsOfPoints(points);
    if (!target) return;
    map.fitBounds(
      [
        [target.west, target.south],
        [target.east, target.north],
      ],
      {
        padding: FIT_PADDING,
        maxZoom: FIT_MAX_ZOOM,
        duration: FIT_DURATION_MS,
      },
    );
    // The camera fits the points it is about to draw, so a frame change is a
    // change of target (SPEC-029 REQ-003).
  }, [fitToken, focusOccurrences, frameMode]);

  // SPEC-030 REQ-008 (AMEND-002): frame the opening view on the data, once.
  //
  // Deliberately once per mount rather than per stage: re-framing every time the
  // age steps would yank the camera out from under a reader who had panned
  // somewhere deliberately, and stepping the age is the loop's most common
  // action. Reuses the search-landing machinery rather than a second code path.
  const autoFittedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!autoFit || autoFittedRef.current || !map || !loadedRef.current) return;
    const points = framePoints(occurrences, frameMode);
    if (points.length === 0) return; // wait for the stage's occurrences
    const target = boundsOfPoints(points);
    if (!target) return;
    autoFittedRef.current = true;
    map.fitBounds(
      [
        [target.west, target.south],
        [target.east, target.north],
      ],
      { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, duration: 0 },
    );
  }, [autoFit, occurrences, frameMode, mapLoaded]);

  // Clear a hover/pinned card whose occurrence has left the view (e.g. stage step);
  // the multi card is dismissed on any occurrence change (its leaves may be stale).
  useEffect(() => {
    const ids = new Set(occurrences.map((o) => o.id));
    if (pinned && !ids.has(pinned.id)) setPinned(null);
    if (hover && !ids.has(hover.id)) setHover(null);
    setMulti(null);
  }, [occurrences, pinned, hover]);

  // SPEC-027 REQ-006: changing mode re-keys every feature, so any card left over
  // belongs to features that no longer exist. Clearing them here also releases
  // the hover suppression those cards hold — a locality cluster click used to
  // strand an invisible card and kill hover until the stage changed.
  useEffect(() => {
    setPinned(null);
    setHover(null);
    setMulti(null);
  }, [mode]);

  const frame = basemap
    ? describeFrame(basemap.meta, occurrenceRotationModel)
    : null;
  // SPEC-016 UX-001: disclose frame-consistent reconstruction only when it is
  // actually applied — i.e. the occurrences carry a frame reconstruction age.
  // SPEC-029 REQ-005: in present-day mode there is no reconstruction to
  // disclose — the points are recorded collection coordinates — so this claim
  // would be false there.
  const reconstructedToFrame =
    frameMode === "paleo" &&
    occurrences.some((o) => o.paleoPosition.value?.reconstructionAgeMa != null);

  // SPEC-015 REQ-003 / AMEND-001: the card shows the pinned occurrence if any,
  // else the hovered one. SPEC-015 REQ-001: the legend shows in point modes.
  const cardAnchor = pinned ?? hover;
  const carded = cardAnchor
    ? occurrences.find((o) => o.id === cardAnchor.id)
    : null;
  const cardedMarker = carded
    ? cladeMarkerForTaxon(carded.taxonId, taxaById)
    : null;
  const showCladeUi = mode !== "locality";
  // The clade key renders only when the map is actually up and the mode uses
  // clade identity; the rail it lives in is suppressed when nothing renders.
  const cladeKeyVisible = available && mapLoaded && showCladeUi;

  return (
    <>
      {available ? (
        <div
          ref={containerRef}
          role="application"
          aria-label="Paleogeographic map of fossil occurrences (reconstruction)"
          style={{ position: "absolute", inset: 0 }}
        />
      ) : (
        <div className={styles.stateWrap} role="note">
          <p>
            The interactive map needs WebGL, which isn’t available here. Use the
            occurrence list to explore — it carries the same occurrences,
            sources and uncertainty.
          </p>
        </div>
      )}
      {available && mapLoaded && (
        <>
          {/* Labels + cluster counts share the map's pixel coordinate space; the
              overlay is non-interactive except the pinned card (which opts in).

              SPEC-021 REQ-002: the overlay itself is no longer gated on
              `showCladeUi` — the count badges must exist in Locality mode too, so
              that REQ-001's accessible name has a carrier wherever clusters do.
              The clade key, the name labels and the cards stay gated, which is
              what `showCladeUi` was actually protecting. */}
          <div className={styles.mapOverlay}>
            {/* SPEC-027 REQ-001: the badge dims with the disc it labels while a
                taxon is focused, so the emphasis overlay is not competing with
                bright pills. (Rendering it in every mode is SPEC-021 REQ-002's,
                above — SPEC-027 only adds the dim.) */}
            {clusterCounts.map((c) => {
              const r = clusterDiscRadius(c.count);
              return (
                <span
                  key={c.key}
                  className={`${styles.clusterCount} ${
                    focusIds && focusIds.length > 0
                      ? styles.clusterCountDim
                      : ""
                  }`}
                  style={{ left: c.x + r * 0.62, top: c.y - r * 0.62 }}
                  /* SPEC-021 REQ-001: the badge states the unit it counts, on the
                     cluster itself. The visible glyph stays the bare number; the
                     unit rides in the accessible name, so a cluster can never be
                     read as a count of distinct taxa. */
                  role="img"
                  aria-label={clusterCountLabel(c.count, mode)}
                >
                  {c.count}
                </span>
              );
            })}
            {showCladeUi &&
              labels.map((l) => (
                <span
                  key={l.id}
                  className={`sciName ${styles.mapLabel}`}
                  style={{ left: l.x, top: l.y }}
                  aria-hidden="true"
                >
                  {l.taxon}
                </span>
              ))}
            {showCladeUi && !multi && cardAnchor && carded && cardedMarker && (
              <MapHoverCard
                content={hoverCardContent(carded, cardedMarker.label)}
                x={cardAnchor.x}
                y={cardAnchor.y}
                iconSrc={cardedMarker.src}
                pinned={Boolean(pinned)}
                onOpenProfile={
                  onOpenProfileRef.current
                    ? () => onOpenProfileRef.current?.(carded.taxonId)
                    : undefined
                }
                onClose={() => setPinned(null)}
              />
            )}
            {showCladeUi && multi && (
              <MapSpeciesCard
                x={multi.x}
                y={multi.y}
                species={multi.rows.map((r): SpeciesRow => {
                  const mk = cladeMarkerById(r.iconKey);
                  return {
                    taxonId: r.taxonId,
                    taxon: r.taxon,
                    clade: mk.label,
                    iconSrc: mk.src,
                    hasPage: Boolean(taxaById.get(r.taxonId)?.wikipedia),
                  };
                })}
                onOpenProfile={(tid) => {
                  setMulti(null);
                  onOpenProfileRef.current?.(tid);
                }}
                // SPEC-027 REQ-005: in taxon mode, picking a species out of a
                // cluster selects it on the map — the mode's own unit — rather
                // than leaving the map for the profile.
                onSelectTaxon={
                  onSelectTaxonRef.current
                    ? (tid) => {
                        setMulti(null);
                        onSelectTaxonRef.current?.(tid);
                      }
                    : undefined
                }
                onClose={() => setMulti(null)}
              />
            )}
          </div>
        </>
      )}
      {/* SPEC-023 REQ-002/REQ-003: the bottom-left rail — reading the map and its
          provenance. DOM order is the reading order from the corner outward, so
          the ⓘ comes first (corner-most) and its popover, which opens upward,
          paints over its rail siblings without needing a z-index. The rail is
          suppressed entirely when neither child renders (REQ-001). */}
      {(cladeKeyVisible || (basemap && frame)) && (
        <div
          className={`${styles.mapRail} ${styles.railBottomLeft}`}
          data-map-rail="bottom-left"
        >
          {basemap && frame && (
            <div
              className={styles.basemapAttribution}
              data-map-overlay="basemap-attribution"
            >
              <button
                type="button"
                className={styles.attributionToggle}
                aria-expanded={attributionOpen}
                aria-label="Basemap source and reconstruction details"
                onClick={() => setAttributionOpen((open) => !open)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="8" cy="4.4" r="1" fill="currentColor" />
                  <rect
                    x="7.15"
                    y="6.6"
                    width="1.7"
                    height="5.2"
                    rx="0.5"
                    fill="currentColor"
                  />
                </svg>
              </button>
              {attributionOpen && (
                <div className={styles.attributionPopover} role="note">
                  <strong>{basemap.meta.name}</strong> · {basemap.meta.source} ·{" "}
                  {basemap.meta.licence}
                  <br />
                  {/* SPEC-029 REQ-005: the two frames make different kinds of
                      claim. Paleogeographic mode asserts a reconstruction under
                      a stated rotation model; present-day mode asserts nothing
                      but the coordinates the collection was recorded at. Showing
                      the reconstruction's provenance over recorded coordinates
                      would make the weaker claim look stronger, so each mode
                      discloses only what is true of it. */}
                  {frameMode === "present" ? (
                    <>
                      {basemap.meta.note} Points are the coordinates recorded
                      with each collection — not reconstructions. The selected
                      age still chooses which occurrences are shown.
                    </>
                  ) : (
                    <>
                      {!frameExact && (
                        <>
                          Nearest available reconstruction (
                          {basemap.meta.targetAgeMa} Ma) shown for {stageName}
                          .{" "}
                        </>
                      )}
                      {frame.note} {basemap.meta.note}
                      {reconstructedToFrame && (
                        <>
                          {" "}
                          Occurrences are reconstructed to this frame’s age, so
                          each point sits on the coastline shown (SPEC-016).
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {cladeKeyVisible && (
            <div
              className={styles.mapLegend2}
              role="note"
              aria-label="Clade key"
              data-map-overlay="clade-key"
            >
              {/* UX-001: the clade key is a reading aid, so it may be collapsed
                  — by the reader, never automatically by viewport. Provenance
                  and uncertainty overlays stay put. */}
              <button
                type="button"
                className={styles.cladeKeyToggle}
                aria-expanded={cladeKeyOpen}
                onClick={() => setCladeKeyOpen((open) => !open)}
              >
                <span aria-hidden="true">{cladeKeyOpen ? "▾" : "▸"}</span> Clade
                key
              </button>
              {cladeKeyOpen && (
                <div
                  className={styles.cladeKeyBody}
                  role="group"
                  aria-label="Clade key"
                  // The key scrolls inside its own box whenever the map pane is
                  // short (measured: at 1280x700 and below, before SPEC-029
                  // existed). A scrollable region must be keyboard-reachable or
                  // its content is unreachable without a pointer — WCAG 2.1.1,
                  // and the same pattern SPEC-025 uses for the cladogram region.
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                  tabIndex={0}
                >
                  {CLADE_MARKERS.map((m) => (
                    <span key={m.id} className={styles.legendItem}>
                      <span
                        className={styles.legendSwatch}
                        style={{ background: m.tint }}
                      />
                      <img className={styles.legendIcon} src={m.src} alt="" />
                      {m.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
