/**
 * Cartographic treatment of the paleogeographic basemap (SPEC-018). Everything
 * here is a **style-layer change over geometry that already ships** — the
 * committed per-stage coastline frames (SPEC-004/008) are read, never modified,
 * and no new source, asset, or host is introduced (SPEC-018 NFR-001, SEC-001).
 *
 * The map used to be three flat elements: an ocean background, a land fill, and
 * a 1px coastline. This module adds the depth-graded sea, the land relief, and
 * the graticule that the design charter specified but the map never rendered —
 * the `--color-ocean-inner` and `--color-grid` tokens were defined and unused.
 *
 * **Owner override (2026-08-05, recorded in `docs/mockups/design-guidelines.md`
 * §4):** the charter's restraint rule no longer constrains the basemap, so the
 * treatments below may be genuinely rich. What the override does *not* relax,
 * and this module still honours: the depth gradation is a cartographic device
 * derived from distance to the coastline and is never presented as measured
 * bathymetry (UX-002); values stay in the charter's cool-neutral family and
 * introduce no second accent (teal remains the data layer's); and contrast is
 * preserved (NFR-003).
 *
 * The bands are drawn as blurred strokes on the coastline itself: the seaward
 * half of each stroke becomes the shelf/slope, and the landward half is covered
 * by the land fill painted over it. That is why no geometry buffering is needed
 * and why stage changes cost nothing beyond the frame swap already happening
 * (NFR-002).
 *
 * Pure and free of MapLibre imports so the whole composition is unit-testable in
 * jsdom without WebGL, matching how the SPEC-004/008 basemap helpers are tested.
 */

/* -------------------------------------------------------------------------- */
/* Palette — mirrors src/app/styles/tokens.css (SPEC-018 UX-001)               */
/* -------------------------------------------------------------------------- */

/** Open water, furthest from land. Charter `--color-ocean-outer`. */
export const OCEAN_DEEP = "#d7e4ec";
/** Mid-depth band between shelf and open water. Charter `--color-ocean-slope`. */
export const OCEAN_SLOPE = "#e3ecf1";
/** Shallow water hugging the coast. Charter `--color-ocean-inner`. */
export const OCEAN_SHELF = "#eef4f7";
/** Reconstructed continental land. Charter `--color-land`. */
export const LAND = "#edf1f1";
/** Land relief: the coastal casing and the interior texture flecks. */
export const LAND_SHADE = "#d3dee1";
/** The coastline stroke itself. Charter `--color-coast`. */
export const COAST = "#a9b9c3";
/** Graticule lines. Charter `--color-grid`. */
export const GRATICULE = "#cdd9e0";
/** The equator, drawn stronger than the rest of the grid (REQ-003). */
export const EQUATOR = "#b6c6d1";

/* -------------------------------------------------------------------------- */
/* Declared constants (SPEC-018 "Configuration impact")                        */
/* -------------------------------------------------------------------------- */

/** Graticule spacing in degrees. Legible without clutter at the opening zoom. */
export const GRATICULE_INTERVAL_DEG = 30;

/**
 * Web Mercator cannot represent the poles; ±85° is the conventional cutoff and
 * keeps meridians from running to infinity.
 */
export const MERCATOR_LAT_LIMIT = 85;

/** Vertex spacing when densifying graticule lines, in degrees. */
const GRATICULE_STEP_DEG = 5;

/**
 * Every layer this module contributes, bottom to top. Declared as one list so
 * NFR-002's "bounded and declared" layer count is a fact the tests can assert
 * rather than a promise in prose. `land-fill` and `land-line` already existed
 * (SPEC-004) and are included because their stacking position matters here.
 */
export const CARTOGRAPHY_LAYER_ORDER = [
  "ocean-slope",
  "ocean-shelf",
  "land-fill",
  "land-inner",
  "land-shade",
  "graticule",
  "graticule-equator",
  "land-line",
] as const;

/** Layers added by SPEC-018 (i.e. excluding the two SPEC-004 already shipped). */
export const CARTOGRAPHY_LAYERS_ADDED = CARTOGRAPHY_LAYER_ORDER.filter(
  (id) => id !== "land-fill" && id !== "land-line",
);

/* -------------------------------------------------------------------------- */
/* Graticule (REQ-003)                                                         */
/* -------------------------------------------------------------------------- */

type Line = [number, number][];

function meridian(lng: number): Line {
  const pts: Line = [];
  for (
    let lat = -MERCATOR_LAT_LIMIT;
    lat < MERCATOR_LAT_LIMIT;
    lat += GRATICULE_STEP_DEG
  ) {
    pts.push([lng, lat]);
  }
  pts.push([lng, MERCATOR_LAT_LIMIT]);
  return pts;
}

function parallel(lat: number): Line {
  const pts: Line = [];
  for (let lng = -180; lng < 180; lng += GRATICULE_STEP_DEG)
    pts.push([lng, lat]);
  pts.push([180, lat]);
  return pts;
}

function lineFeature(coordinates: Line, kind: string): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { kind },
    geometry: { type: "LineString", coordinates },
  };
}

/**
 * The graticule at `interval` degrees, **excluding the equator** — the equator
 * is its own feature collection so it can be drawn distinctly (REQ-003). Lines
 * are densified rather than drawn as two endpoints, so the grid stays correct if
 * the projection ever changes (projection itself is a SPEC-018 non-goal).
 */
export function buildGraticule(
  interval: number = GRATICULE_INTERVAL_DEG,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lng = -180; lng <= 180; lng += interval) {
    features.push(lineFeature(meridian(lng), "meridian"));
  }
  for (let lat = -90 + interval; lat < 90; lat += interval) {
    // The equator is drawn by buildEquator(); skip it here so it is never
    // painted twice at two different weights.
    if (lat === 0) continue;
    if (Math.abs(lat) > MERCATOR_LAT_LIMIT) continue;
    features.push(lineFeature(parallel(lat), "parallel"));
  }
  return { type: "FeatureCollection", features };
}

/**
 * The equator on its own. On a paleomap this is the one grid line with physical
 * meaning — it says where the heat was — so REQ-003 requires it to be visually
 * distinguishable from the rest of the grid.
 */
export function buildEquator(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [lineFeature(parallel(0), "equator")],
  };
}

/* -------------------------------------------------------------------------- */
/* Layer specifications                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Widths grow with zoom so a band keeps its apparent proportion to the coastline
 * as you zoom in, instead of collapsing to a hairline.
 */
function zoomWidth(near: number, far: number): unknown {
  return ["interpolate", ["linear"], ["zoom"], 2, near, 6, far];
}

/**
 * The depth-graded sea (REQ-001): two blurred strokes on the coastline over the
 * deep-water background, giving **three** zones — shelf (lightest, at the coast),
 * slope, then open water. Drawn beneath the land fill, so only the seaward half
 * of each stroke survives.
 *
 * Ordered widest-first: the slope must be laid down before the narrower shelf is
 * painted on top of it, or the shelf would be buried.
 */
export function oceanDepthLayers(source: string): unknown[] {
  return [
    {
      id: "ocean-slope",
      type: "line",
      source,
      paint: {
        "line-color": OCEAN_SLOPE,
        "line-width": zoomWidth(16, 44),
        "line-blur": zoomWidth(13, 36),
      },
    },
    {
      id: "ocean-shelf",
      type: "line",
      source,
      paint: {
        "line-color": OCEAN_SHELF,
        "line-width": zoomWidth(7, 20),
        "line-blur": zoomWidth(5, 14),
      },
    },
  ];
}

/**
 * Land relief (REQ-002): the flat fill, then two coastline-derived casings — a
 * soft wide one that grades into the interior and a tighter one at the rim — so
 * a continent reads as a solid body with a lit centre rather than a flat hole
 * cut in the sea.
 *
 * A tiled procedural stipple was tried first and abandoned: MapLibre silently
 * declined to render a `fill-pattern` from an image registered via `addImage`
 * with raw pixel data (the layer drew fine with a flat `fill-color`, so it was
 * the pattern, not the layer). The spec left the technique open — procedural
 * shading, a tiled texture, or a coastline-distance falloff were all admissible
 * — so this is the falloff.
 *
 * The casing is a centred stroke, so a little of it falls seaward. It is kept
 * deliberately narrow relative to `ocean-shelf` (6/16 against 7/20) so the shelf
 * still reads as the lightest zone at the waterline — REQ-001's light-to-dark
 * ordering survives.
 */
export function landLayers(source: string): unknown[] {
  return [
    {
      id: "land-fill",
      type: "fill",
      source,
      paint: { "fill-color": LAND },
    },
    {
      // The interior falloff: a soft, wide casing that grades from the
      // coastline inward, so a landmass is lighter at its centre than at its
      // rim (REQ-002 — "interiors are not a single uniform flat value").
      id: "land-inner",
      type: "line",
      source,
      paint: {
        "line-color": LAND_SHADE,
        "line-width": zoomWidth(5, 13),
        "line-blur": zoomWidth(9, 24),
        "line-opacity": 0.55,
      },
    },
    {
      id: "land-shade",
      type: "line",
      source,
      paint: {
        "line-color": LAND_SHADE,
        "line-width": zoomWidth(6, 16),
        "line-blur": zoomWidth(5, 12),
      },
    },
  ];
}

/** The crisp coastline, drawn last so nothing below can obscure it (REQ-003). */
export function coastLayer(source: string): unknown {
  return {
    id: "land-line",
    type: "line",
    source,
    // Widened slightly with zoom: the charter's shelf value (#eef4f7) is
    // *lighter* than its land value (#edf1f1), so the waterline cannot carry
    // itself on tone alone — the coastline stroke and the casing inside it are
    // what stop a continent reading as a hole cut in the sea (REQ-002).
    paint: { "line-color": COAST, "line-width": zoomWidth(1, 1.6) },
  };
}

/**
 * Grid and equator (REQ-003). Placed above the land fill so the grid is legible
 * over continents as well as sea — a graticule hidden by Pangaea would defeat
 * the point — but below `land-line` and below the occurrence layers, so it can
 * obscure neither coastlines nor markers.
 */
export function graticuleLayers(grid: string, equator: string): unknown[] {
  return [
    {
      id: "graticule",
      type: "line",
      source: grid,
      paint: {
        "line-color": GRATICULE,
        "line-width": 0.6,
        "line-opacity": 0.9,
      },
    },
    {
      id: "graticule-equator",
      type: "line",
      source: equator,
      paint: {
        "line-color": EQUATOR,
        "line-width": 1.2,
        "line-opacity": 0.95,
      },
    },
  ];
}
