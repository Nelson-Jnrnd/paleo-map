// @vitest-environment jsdom
/**
 * SPEC-018 REQ-002 — land relief. Continents must read as solid bodies rather
 * than flat holes cut in the sea: a fill, an interior stipple so the interior is
 * not one uniform value, and a soft coastal casing.
 */

import { expect, test } from "vitest";
import {
  LAND,
  LAND_SHADE,
  OCEAN_SHELF,
  landLayers,
  oceanDepthLayers,
} from "../../src/app/components/mapCartography.js";

interface Layer {
  id: string;
  type: string;
  source: string;
  paint: Record<string, unknown>;
}

const layers = landLayers("basemap") as unknown as Layer[];
const byId = (id: string): Layer => layers.find((l) => l.id === id)!;

const widthAtOpeningZoom = (l: Layer): number =>
  (l.paint["line-width"] as unknown[])[4] as number;

test("the land treatment applies to every land polygon in the frame", () => {
  // All three read the same basemap source with no filter, so no polygon is
  // excluded — the treatment cannot apply to only some landmasses.
  for (const layer of layers) {
    expect(layer.source).toBe("basemap");
    expect(layer).not.toHaveProperty("filter");
  }
});

test("continental interiors are not a single uniform flat value", () => {
  // Relief is a two-stage coastline-distance falloff: a soft wide casing that
  // grades into the interior, and a tighter one at the rim. So a landmass is
  // lighter at its centre than at its edge rather than one flat value.
  const inner = byId("land-inner");
  const rim = byId("land-shade");
  expect(inner.type).toBe("line");
  expect(rim.type).toBe("line");
  // The interior casing is the softer of the two: more blur per unit width.
  const softness = (l: Layer): number =>
    ((l.paint["line-blur"] as unknown[])[4] as number) /
    ((l.paint["line-width"] as unknown[])[4] as number);
  expect(softness(inner)).toBeGreaterThan(softness(rim));
});

test("relief is drawn from the coastline, so it costs no new geometry", () => {
  // Both casings are strokes on the frame already loaded — nothing is buffered
  // or recomputed, which is what keeps NFR-002 satisfied on a stage change.
  for (const id of ["land-inner", "land-shade"]) {
    expect(byId(id).source).toBe("basemap");
  }
});

test("only cool-neutral charter values are used; no new accent or hue family", () => {
  expect(byId("land-fill").paint["fill-color"]).toBe(LAND);
  expect(byId("land-shade").paint["line-color"]).toBe(LAND_SHADE);
  // A cool blue-grey: the blue channel is never the weakest of the three.
  const b = parseInt(LAND_SHADE.slice(5, 7), 16);
  const r = parseInt(LAND_SHADE.slice(1, 3), 16);
  expect(b).toBeGreaterThanOrEqual(r);
});

test("the casing stays narrower than the shelf, so the shelf remains the lightest zone at the waterline", () => {
  // The casing is a centred stroke, so half of it falls seaward. Keeping it
  // clearly narrower than `ocean-shelf` is what preserves REQ-001's
  // light-to-dark ordering at the coast.
  const shelf = (oceanDepthLayers("basemap") as unknown as Layer[]).find(
    (l) => l.id === "ocean-shelf",
  )!;
  expect(widthAtOpeningZoom(byId("land-shade"))).toBeLessThan(
    widthAtOpeningZoom(shelf),
  );
  expect(OCEAN_SHELF).not.toBe(LAND_SHADE);
});

test("small polygons are not swallowed by the edge treatment", () => {
  // The casing is blurred rather than a hard band, and narrower than the shelf,
  // so an island keeps a lit centre instead of going solid.
  const shade = byId("land-shade");
  expect(shade.paint["line-blur"]).toBeDefined();
  expect(widthAtOpeningZoom(shade)).toBeLessThan(12);
});
