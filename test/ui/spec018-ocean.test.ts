// @vitest-environment jsdom
/**
 * SPEC-018 REQ-001 — the depth-graded ocean. Three zones, light at the coast and
 * dark in open water, derived from the coastline geometry that already ships.
 * Asserted on the constructed layer specs (no WebGL), the same way the SPEC-004
 * basemap helpers are tested.
 */

import { expect, test } from "vitest";
import {
  OCEAN_DEEP,
  OCEAN_SHELF,
  OCEAN_SLOPE,
  oceanDepthLayers,
} from "../../src/app/components/mapCartography.js";

interface LineLayer {
  id: string;
  type: string;
  source: string;
  paint: Record<string, unknown>;
}

const layers = oceanDepthLayers("basemap") as unknown as LineLayer[];

/** The near→far width at the opening zoom, from an ["interpolate",…] stop list. */
function widthAtOpeningZoom(layer: LineLayer): number {
  const expr = layer.paint["line-width"] as unknown[];
  // ["interpolate", ["linear"], ["zoom"], 2, near, 6, far]
  return expr[4] as number;
}

test("three distinct depth zones exist, ordered light-to-dark from the coast", () => {
  // The background supplies the third (deepest) zone; the two line layers supply
  // the shelf and the slope.
  const values = [OCEAN_SHELF, OCEAN_SLOPE, OCEAN_DEEP];
  expect(new Set(values).size).toBe(3);

  // Light-to-dark with distance from the coastline: shelf is the lightest.
  const luminance = (hex: string): number =>
    parseInt(hex.slice(1, 3), 16) +
    parseInt(hex.slice(3, 5), 16) +
    parseInt(hex.slice(5, 7), 16);
  expect(luminance(OCEAN_SHELF)).toBeGreaterThan(luminance(OCEAN_SLOPE));
  expect(luminance(OCEAN_SLOPE)).toBeGreaterThan(luminance(OCEAN_DEEP));
});

test("both charter ocean tokens are referenced by the rendered style", () => {
  const colours = layers.map((l) => l.paint["line-color"]);
  expect(colours).toContain(OCEAN_SHELF); // --color-ocean-inner, previously unused
  expect(colours).toContain(OCEAN_SLOPE);
});

test("the slope is laid down before the narrower shelf, or the shelf is buried", () => {
  expect(layers.map((l) => l.id)).toEqual(["ocean-slope", "ocean-shelf"]);
  expect(widthAtOpeningZoom(layers[0]!)).toBeGreaterThan(
    widthAtOpeningZoom(layers[1]!),
  );
});

test("the bands follow the coastline of whichever frame is displayed", () => {
  // Both read the shared `basemap` source, so a frame swap (SPEC-008 REQ-004
  // setData) re-derives them with no extra work — that is what makes the
  // gradation stage-correct at every step.
  for (const layer of layers) {
    expect(layer.source).toBe("basemap");
    expect(layer.type).toBe("line");
  }
});

test("bands are blurred, so the gradation has no visible seam", () => {
  for (const layer of layers) {
    expect(layer.paint["line-blur"]).toBeDefined();
  }
});

test("no new source, asset, or network target is introduced", () => {
  // NFR-001/SEC-001: the only source referenced is the committed basemap frame.
  expect(new Set(layers.map((l) => l.source))).toEqual(new Set(["basemap"]));
});
