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
  LAND_TEXTURE_ID,
  LAND_TEXTURE_MAX_ALPHA,
  LAND_TEXTURE_SIZE,
  OCEAN_SHELF,
  buildLandTexture,
  landLayers,
  oceanDepthLayers,
} from "../../src/app/components/mapCartography.js";

interface Layer {
  id: string;
  type: string;
  source: string;
  paint: Record<string, unknown>;
}

const layers = landLayers("basemap", LAND_TEXTURE_ID) as unknown as Layer[];
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

test("AMEND-001: the stipple is a Uint8ClampedArray — the root cause of the first failure", () => {
  // MapLibre's addImage accepts a plain Uint8Array without complaint but then
  // never renders it as a fill-pattern, which is what defeated the first attempt
  // and got mis-diagnosed as a MapLibre limitation. Guarding the actual cause.
  const texture = buildLandTexture();
  expect(texture.data).toBeInstanceOf(Uint8ClampedArray);
  expect(texture.width).toBe(LAND_TEXTURE_SIZE);
  expect(texture.height).toBe(LAND_TEXTURE_SIZE);
  expect(texture.data.length).toBe(LAND_TEXTURE_SIZE * LAND_TEXTURE_SIZE * 4);
});

test("AMEND-001: the stipple reaches the deep interior, where the falloff cannot", () => {
  const texture = byId("land-texture");
  expect(texture.type).toBe("fill");
  expect(texture.paint["fill-pattern"]).toBe(LAND_TEXTURE_ID);
  // A fill covers the whole polygon, so it is present in the middle of a
  // supercontinent as much as at its rim — which is the point.
  expect(texture).not.toHaveProperty("filter");
});

test("AMEND-001: the stipple varies, is deterministic, and stays subtle", () => {
  const { data } = buildLandTexture();
  const alphas = new Set<number>();
  let max = 0;
  for (let i = 3; i < data.length; i += 4) {
    alphas.add(data[i]!);
    max = Math.max(max, data[i]!);
  }
  expect(alphas.size).toBeGreaterThan(1); // not a flat wash
  expect(max).toBeGreaterThan(30); // perceptible
  expect(max).toBeLessThanOrEqual(LAND_TEXTURE_MAX_ALPHA); // never dirt
  expect(Array.from(buildLandTexture().data)).toEqual(Array.from(data));
});

test("AMEND-001: the stipple encodes nothing — one colour, noise alpha only", () => {
  // If it varied with anything real it would be data, which UX-002 forbids.
  const { data } = buildLandTexture();
  const rgb = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    rgb.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  expect(rgb.size).toBe(1);
});

test("relief is drawn from the coastline, so it costs no new geometry", () => {
  // Both casings are strokes on the frame already loaded — nothing is buffered
  // or recomputed, which is what keeps NFR-002 satisfied on a stage change.
  for (const id of ["land-inner", "land-shade", "land-texture"]) {
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
