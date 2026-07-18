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
 * the map discloses that mismatch in an always-present DOM overlay (SPEC-004
 * REQ-002/003) — visible even where WebGL is unavailable, which is also the
 * accessible, canvas-independent path (charter / SPEC-002 canvas-a11y edge case):
 * where WebGL is missing the map degrades to a note and the occurrence list
 * remains the equivalent route.
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type {
  Map as MapLibreMap,
  GeoJSONSource,
  MapMouseEvent,
} from "maplibre-gl";
import type { ReadOccurrence } from "../../domain/index.js";
import { describeFrame, loadBasemap } from "../data/basemap.js";
import type { Basemap } from "../data/basemap.js";
import type { Bounds } from "../state/aggregate.js";
import styles from "./exploration.module.css";

interface OccurrenceMapProps {
  occurrences: readonly ReadOccurrence[];
  selectedId: string | null;
  onSelect: (occurrenceId: string) => void;
  /** The occurrences' pinned rotation model, for basemap frame reconciliation. */
  occurrenceRotationModel: string;
  /** Reports the map's current bounds on load and on pan/zoom (SPEC-005 REQ-002). */
  onViewportChange?: (bounds: Bounds) => void;
}

const OCEAN_OUTER = "#d7e4ec";
const LAND = "#edf1f1";
const COAST = "#a9b9c3";
const ACCENT = "#0f9d83";
const ACCENT_CLUSTER = "#17a98c";

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

function toFeatureCollection(
  occurrences: readonly ReadOccurrence[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const o of occurrences) {
    const paleo = o.paleoPosition.value;
    if (!paleo) continue; // no paleocoordinate → not placeable on the paleo map
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [paleo.palaeoLng, paleo.palaeoLat],
      },
      properties: { id: o.id, taxon: o.taxonName },
    });
  }
  return { type: "FeatureCollection", features };
}

export function OccurrenceMap({
  occurrences,
  selectedId,
  onSelect,
  occurrenceRotationModel,
  onViewportChange,
}: OccurrenceMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const [available, setAvailable] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<Basemap | null>(null);

  // Load the basemap once (independent of WebGL) so its attribution/disclosure
  // shows even when the canvas cannot render (SPEC-004 REQ-004).
  useEffect(() => {
    let cancelled = false;
    void loadBasemap().then((b) => {
      if (!cancelled) setBasemap(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          map.remove();
        };
        map.on("load", () => {
          map.addSource("occurrences", {
            type: "geojson",
            data: toFeatureCollection(occurrences),
            cluster: true,
            clusterRadius: 40,
          });
          // Group (cluster) — larger disc.
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "occurrences",
            filter: ["has", "point_count"],
            paint: {
              // Deepen + enlarge with magnitude so a big cluster reads as big
              // (not colour alone — radius carries it too; PERF-250).
              "circle-color": [
                "step",
                ["get", "point_count"],
                ACCENT_CLUSTER,
                25,
                "#0f9d83",
                100,
                "#0c8f76",
              ],
              "circle-radius": [
                "step",
                ["get", "point_count"],
                12,
                10,
                16,
                50,
                22,
                200,
                30,
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });
          // Individual occurrence — smaller ring; selected gets a halo.
          map.addLayer({
            id: "points",
            type: "circle",
            source: "occurrences",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ACCENT,
              "circle-radius": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                9,
                6,
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                3,
                1.5,
              ],
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
          map.on("moveend", reportBounds); // pan/zoom (SPEC-005 REQ-002)

          map.on(
            "click",
            "points",
            (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
              const id = e.features?.[0]?.properties?.["id"];
              if (typeof id === "string") onSelectRef.current(id);
            },
          );
          map.on("click", "clusters", (e: MapMouseEvent) => {
            map.easeTo({ center: e.lngLat, zoom: map.getZoom() + 2 });
          });
          for (const layer of ["points", "clusters"]) {
            map.on("mouseenter", layer, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", layer, () => {
              map.getCanvas().style.cursor = "";
            });
          }
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
    if (map.getSource("basemap")) return;
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

  // Sync source data when the visible occurrences change (PERF-360).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource("occurrences") as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(occurrences));
  }, [occurrences]);

  // Sync the selected-point emphasis.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("points")) return;
    map.setPaintProperty("points", "circle-radius", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      9,
      6,
    ]);
    map.setPaintProperty("points", "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      3,
      1.5,
    ]);
  }, [selectedId]);

  const frame = basemap
    ? describeFrame(basemap.meta, occurrenceRotationModel)
    : null;

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
      {basemap && frame && (
        <div className={styles.basemapAttribution} role="note">
          <strong>{basemap.meta.name}</strong> · {basemap.meta.source} ·{" "}
          {basemap.meta.licence}
          <br />
          {frame.note} {basemap.meta.note}
        </div>
      )}
    </>
  );
}
