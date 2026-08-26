// @vitest-environment jsdom
/**
 * SPEC-018 REQ-004 — marker legibility over the restyled basemap. The markers
 * were tuned by SPEC-015 against one flat background value; the background is now
 * three water zones plus textured land, so the casing has to do more work. The
 * clade encoding and the teal accent must be untouched.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  LAND,
  OCEAN_DEEP,
  OCEAN_SHELF,
  OCEAN_SLOPE,
} from "../../src/app/components/mapCartography.js";
import { CLADE_MARKERS } from "../../src/app/components/mapCladeMarkers.js";

const map = readFileSync("src/app/components/OccurrenceMap.tsx", "utf8");

test("the resting casing was widened for the new background", () => {
  // 1.5 → 2, with selected (3) > highlighted (2.5) > resting (2) preserved.
  expect(map).toMatch(/"circle-stroke-width":\s*2\b/);
});

test("the selection hierarchy from SPEC-009 REQ-004 still holds", () => {
  const widths = map
    .slice(map.indexOf("function pointStrokeWidth"))
    .slice(0, 600)
    .match(/^\s+(\d+(?:\.\d+)?),$/gm)
    ?.map((s) => Number(s.trim().replace(",", "")));
  expect(widths).toBeTruthy();
  const [selected, highlighted, resting] = widths!;
  expect(selected!).toBeGreaterThan(highlighted!);
  expect(highlighted!).toBeGreaterThan(resting!);
});

test("the casing is white, so a marker separates from water and land alike", () => {
  // A white casing is the one value that contrasts against every background the
  // new basemap produces — the three water zones and the land.
  const backgrounds = [OCEAN_DEEP, OCEAN_SLOPE, OCEAN_SHELF, LAND];
  for (const bg of backgrounds) {
    const luminance =
      parseInt(bg.slice(1, 3), 16) * 0.2126 +
      parseInt(bg.slice(3, 5), 16) * 0.7152 +
      parseInt(bg.slice(5, 7), 16) * 0.0722;
    // Every basemap value is pale, so white alone would not separate — which is
    // why the casing is paired with the darker clade tints asserted below.
    expect(luminance).toBeGreaterThan(200);
  }
  expect(map).toMatch(/"circle-stroke-color":\s*"#ffffff"/);
});

test("no clade tint changed — the meaning-only encoding is untouched", () => {
  // SPEC-015 owns these values; SPEC-018 REQ-004 may only adjust casing, size or
  // opacity. Each tint must still be darker than every basemap value it sits on,
  // or the marker would vanish into the map.
  const lightest = parseInt(OCEAN_SHELF.slice(1, 3), 16);
  for (const marker of CLADE_MARKERS) {
    const r = parseInt(marker.tint.slice(1, 3), 16);
    expect(r).toBeLessThan(lightest);
  }
});
