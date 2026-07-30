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
import type { Bounds } from "../state/viewport.js";
import type { GroupingMode, LocalityGroup } from "../state/grouping.js";
import {
  CLADE_MARKERS,
  FALLBACK_MARKER,
  cladeMarkerForTaxon,
} from "./mapCladeMarkers.js";
import { MapHoverCard, hoverCardContent } from "./MapHoverCard.js";
import { computeMapLabels } from "./mapLabels.js";
import type { LabelCandidate, MapLabel } from "./mapLabels.js";
import styles from "./exploration.module.css";

/** SPEC-015 REQ-002: name labels appear only once zoomed past this level. */
const LABEL_MIN_ZOOM = 4;

interface OccurrenceMapProps {
  occurrences: readonly ReadOccurrence[];
  selectedId: string | null;
  onSelect: (featureId: string) => void;
  /** The occurrences' pinned rotation model, for basemap frame reconciliation. */
  occurrenceRotationModel: string;
  /** Selected stage — selects the time-varying basemap frame (SPEC-008 REQ-004). */
  stageName: string;
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

const OCEAN_OUTER = "#d7e4ec";
const LAND = "#edf1f1";
const COAST = "#a9b9c3";
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
    1.5,
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

/** Self-contained style — background only, no external tiles/glyphs (SEC-001). */
const BASE_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "ocean",
      type: "background" as const,
      paint: { "background-color": OCEAN_OUTER },
    },
  ],
};

/**
 * SPEC-015 REQ-001 (#4): load a bundled clade PNG and strip its opaque near-white
 * background to transparency, in the browser via a canvas — so the silhouette
 * sits cleanly on the round coin instead of a white square. Self-contained (the
 * asset is bundled; no egress). Returns a MapLibre-addable RGBA image.
 */
async function loadMaskedImage(
  src: string,
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! > 238 && d[i + 1]! > 238 && d[i + 2]! > 238) d[i + 3] = 0;
  }
  return { width: canvas.width, height: canvas.height, data: d };
}

function toFeatureCollection(
  occurrences: readonly ReadOccurrence[],
  taxaById: ReadonlyMap<string, ReadTaxon>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const o of occurrences) {
    const paleo = o.paleoPosition.value;
    if (!paleo) continue; // no paleocoordinate → not placeable on the paleo map
    // SPEC-015: resolve the clade marker (icon + tint) for data-driven paint.
    const marker = cladeMarkerForTaxon(o.taxonId, taxaById);
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [paleo.palaeoLng, paleo.palaeoLat],
      },
      properties: {
        id: o.id,
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
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const g of localities) {
    if (!g.paleo) continue; // no paleocoordinate → not placeable
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [g.paleo.palaeoLng, g.paleo.palaeoLat],
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
): GeoJSON.FeatureCollection {
  return mode === "locality"
    ? toLocalityFeatureCollection(localities)
    : toFeatureCollection(occurrences, taxaById);
}

/**
 * Point opacity for the taxon focus (SPEC-010 REQ-004): when a taxon is selected
 * its occurrence points stay fully opaque and the rest dim — emphasis, not hue.
 * No focus → everything opaque.
 */
function pointOpacity(focusIds: readonly string[] | null | undefined): unknown {
  if (!focusIds || focusIds.length === 0) return 1;
  return ["case", ["in", ["get", "id"], ["literal", [...focusIds]]], 1, 0.2];
}

export function OccurrenceMap({
  occurrences,
  selectedId,
  onSelect,
  occurrenceRotationModel,
  stageName,
  onViewportChange,
  highlightedId = null,
  onHover,
  mode = "occurrence",
  localities = [],
  focusIds = null,
  taxaById = new Map(),
  onOpenProfile,
}: OccurrenceMapProps): ReactElement {
  const onOpenProfileRef = useRef(onOpenProfile);
  onOpenProfileRef.current = onOpenProfile;
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
  const [labels, setLabels] = useState<MapLabel[]>([]);
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
    setClusterCounts(counts);

    // Keep the pinned card anchored to its marker as the map moves.
    const pin = pinnedRef.current;
    if (pin) {
      const o = occurrencesRef.current.find((x) => x.id === pin.id);
      const paleo = o?.paleoPosition.value;
      if (paleo) {
        const p = map.project([paleo.palaeoLng, paleo.palaeoLat]);
        if (p.x !== pin.x || p.y !== pin.y) {
          setPinned({ id: pin.id, x: p.x, y: p.y });
        }
      }
    }

    // Name labels — unclustered markers only, zoom-gated, collision-culled.
    if (modeRef.current === "locality" || map.getZoom() < LABEL_MIN_ZOOM) {
      setLabels([]);
      return;
    }
    const seen = new Set<string>();
    const candidates: LabelCandidate[] = [];
    for (const f of map.queryRenderedFeatures({ layers: ["points-icon"] })) {
      const id = f.properties?.["id"];
      const taxon = f.properties?.["taxon"];
      if (typeof id !== "string" || typeof taxon !== "string" || seen.has(id)) {
        continue;
      }
      if (f.geometry.type !== "Point") continue;
      seen.add(id);
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const p = map.project([lng, lat]);
      candidates.push({ id, taxon, x: p.x, y: p.y });
    }
    setLabels(computeMapLabels(candidates));
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
  // Basemap provenance is disclosed via a compact info button so its text can't
  // overlap the map; the details open in a popover anchored above the button.
  const [attributionOpen, setAttributionOpen] = useState(false);

  // Load the per-stage frame index once (independent of WebGL). Failure leaves it
  // null → the effect below degrades to the graticule (SPEC-004/008 REQ-004).
  useEffect(() => {
    let cancelled = false;
    void loadBasemapFrameIndex().then((idx) => {
      if (!cancelled) setFrameIndex(idx);
    });
    return () => {
      cancelled = true;
    };
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
    const picked = selectFrame(stageName, frameIndex.frames);
    if (!picked) {
      setBasemap(null);
      return;
    }
    setFrameExact(picked.exact);
    void loadBasemap(picked.frame.geojsonUrl, picked.frame.metaUrl).then(
      (b) => {
        if (!cancelled) setBasemap(b);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [frameIndex, stageName]);

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
                  const masked = await loadMaskedImage(m.src);
                  if (!map.hasImage(m.id)) map.addImage(m.id, masked);
                } catch {
                  /* a missing icon just falls back to the tinted disc */
                }
              }),
            );
            if (cancelled || !mapRef.current) return;

            map.addSource("occurrences", {
              type: "geojson",
              data: featuresForMode(mode, occurrences, localities, taxaById),
              cluster: true,
              // Decluster sooner (SPEC-015): a smaller radius + a max-zoom cap
              // surface individual clade icons earlier and stop clustering once
              // zoomed in, so labels sit on real markers, not clusters.
              clusterRadius: 28,
              clusterMaxZoom: 7,
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
                "circle-stroke-width": 1.5,
              },
            });
            map.addLayer({
              id: "clusters-icon",
              type: "symbol",
              source: "occurrences",
              filter: ["has", "point_count"],
              layout: {
                "icon-image": FALLBACK_MARKER.id,
                "icon-size": [
                  "step",
                  ["get", "point_count"],
                  0.014,
                  50,
                  0.02,
                  200,
                  0.026,
                ] as never,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
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
                "circle-opacity": pointOpacity(focusIds) as never,
                "circle-stroke-opacity": pointOpacity(focusIds) as never,
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
                  0.018,
                  6,
                  0.032,
                ] as never,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
              paint: { "icon-opacity": pointOpacity(focusIds) as never },
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
              const pf = map.queryRenderedFeatures(e.point, {
                layers: ["points-bg", "points-icon"],
              });
              const pid = pf[0]?.properties?.["id"];
              if (typeof pid === "string") {
                setPinned({ id: pid, x: e.point.x, y: e.point.y });
                onSelectRef.current(pid);
                return;
              }
              const cf = map.queryRenderedFeatures(e.point, {
                layers: ["clusters"],
              });
              const cg = cf[0]?.geometry;
              if (cg && cg.type === "Point") {
                map.easeTo({
                  center: cg.coordinates as [number, number],
                  zoom: map.getZoom() + 2,
                });
                return;
              }
              setPinned(null);
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
              if (pinnedRef.current) return;
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
    map.addLayer(
      {
        id: "land-fill",
        type: "fill",
        source: "basemap",
        paint: { "fill-color": LAND },
      },
      "clusters",
    );
    map.addLayer(
      {
        id: "land-line",
        type: "line",
        source: "basemap",
        paint: { "line-color": COAST, "line-width": 1 },
      },
      "clusters",
    );
  }, [mapLoaded, basemap]);

  // Sync source data when the visible occurrences, mode, or localities change
  // (PERF-360; SPEC-010 REQ-002/003).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource("occurrences") as GeoJSONSource | undefined;
    source?.setData(featuresForMode(mode, occurrences, localities, taxaById));
    updateOverlaysRef.current();
  }, [occurrences, localities, mode, taxaById]);

  // Sync the taxon focus emphasis (SPEC-010 REQ-004): dim the tinted disc + icon.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("points-bg")) return;
    map.setPaintProperty(
      "points-bg",
      "circle-opacity",
      pointOpacity(focusIds) as never,
    );
    map.setPaintProperty(
      "points-bg",
      "circle-stroke-opacity",
      pointOpacity(focusIds) as never,
    );
    if (map.getLayer("points-icon")) {
      map.setPaintProperty(
        "points-icon",
        "icon-opacity",
        pointOpacity(focusIds) as never,
      );
    }
  }, [focusIds]);

  // Sync the selected- and highlighted-point emphasis (SPEC-009 REQ-004).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("points-bg")) return;
    // The coin radius is fixed (by zoom); selection/highlight is shown by the
    // ring stroke only, so the marker size stays stable (SPEC-009 REQ-004).
    map.setPaintProperty(
      "points-bg",
      "circle-stroke-width",
      pointStrokeWidth(selectedId, highlightedId) as never,
    );
    map.setPaintProperty(
      "points-bg",
      "circle-stroke-color",
      pointStrokeColor(selectedId, highlightedId) as never,
    );
  }, [selectedId, highlightedId]);

  // Clear a hover/pinned card whose occurrence has left the view (e.g. stage step).
  useEffect(() => {
    const ids = new Set(occurrences.map((o) => o.id));
    if (pinned && !ids.has(pinned.id)) setPinned(null);
    if (hover && !ids.has(hover.id)) setHover(null);
  }, [occurrences, pinned, hover]);

  const frame = basemap
    ? describeFrame(basemap.meta, occurrenceRotationModel)
    : null;

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
      {available && mapLoaded && showCladeUi && (
        <>
          {/* Labels + cluster counts share the map's pixel coordinate space; the
              overlay is non-interactive except the pinned card (which opts in). */}
          <div className={styles.mapOverlay}>
            {clusterCounts.map((c) => (
              <span
                key={c.key}
                className={styles.clusterCount}
                style={{ left: c.x, top: c.y }}
                aria-hidden="true"
              >
                {c.count}
              </span>
            ))}
            {labels.map((l) => (
              <span
                key={l.id}
                className={`sciName ${styles.mapLabel}`}
                style={{ left: l.x, top: l.y }}
                aria-hidden="true"
              >
                {l.taxon}
              </span>
            ))}
            {cardAnchor && carded && cardedMarker && (
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
          </div>
          <div className={styles.mapLegend2} role="note" aria-label="Clade key">
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
        </>
      )}
      {basemap && frame && (
        <div className={styles.basemapAttribution}>
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
              {!frameExact && (
                <>
                  Nearest available reconstruction ({basemap.meta.targetAgeMa}{" "}
                  Ma) shown for {stageName}.{" "}
                </>
              )}
              {frame.note} {basemap.meta.note}
            </div>
          )}
        </div>
      )}
    </>
  );
}
