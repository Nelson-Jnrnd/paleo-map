// @vitest-environment jsdom
/**
 * SPEC-018 NFR-002 — map interaction performance. The added layers must be
 * bounded and declared, and none of them may recompute geometry while the user
 * pans or zooms: derivation happens on frame change only.
 */

import { expect, test } from "vitest";
import {
  CARTOGRAPHY_LAYERS_ADDED,
  CARTOGRAPHY_LAYER_ORDER,
  coastLayer,
  graticuleLayers,
  landLayers,
  oceanDepthLayers,
} from "../../src/app/components/mapCartography.js";

interface Layer {
  id: string;
  source: string;
  paint: Record<string, unknown>;
}

const all = [
  ...(oceanDepthLayers("basemap") as unknown as Layer[]),
  ...(landLayers("basemap", "tex") as unknown as Layer[]),
  ...(graticuleLayers("graticule", "equator") as unknown as Layer[]),
  coastLayer("basemap") as unknown as Layer,
];

test("the added layer count is bounded and declared", () => {
  // Seven: two ocean bands, two land relief casings, the interior stipple, the
  // grid and the equator. `land-fill`/`land-line` already shipped with SPEC-004.
  expect(CARTOGRAPHY_LAYERS_ADDED).toHaveLength(7);
  expect(CARTOGRAPHY_LAYER_ORDER).toHaveLength(9);
});

test("every declared layer is actually produced, and nothing extra is", () => {
  expect(new Set(all.map((l) => l.id))).toEqual(
    new Set(CARTOGRAPHY_LAYER_ORDER),
  );
});

test("no layer recomputes geometry during pan or zoom", () => {
  // Zoom-dependent *paint* interpolation is evaluated by the GPU per frame and is
  // free; what would cost is geometry derived per frame. Every layer here reads a
  // static source, so panning and zooming touch no JS.
  for (const layer of all) {
    expect(["basemap", "graticule", "equator"]).toContain(layer.source);
  }
});

test("widths scale with zoom rather than being recomputed in JS", () => {
  const zoomDriven = all.filter((l) => Array.isArray(l.paint["line-width"]));
  for (const layer of zoomDriven) {
    const expr = layer.paint["line-width"] as unknown[];
    expect(expr[0]).toBe("interpolate");
    expect(expr[2]).toEqual(["zoom"]);
  }
});
