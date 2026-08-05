// @vitest-environment jsdom
/**
 * SPEC-018 SEC-001 / NFR-001 — the map style stays self-contained. No tiles, no
 * glyphs, no sprites, no fonts from any third-party host, and no growth in the
 * committed basemap payload.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  buildEquator,
  buildGraticule,
} from "../../src/app/components/mapCartography.js";

const cartography = readFileSync(
  "src/app/components/mapCartography.ts",
  "utf8",
);

test("no external host appears in the cartography module", () => {
  const urls = cartography.match(/https?:\/\/[^\s"'`]+/g) ?? [];
  expect(urls).toEqual([]);
});

test("the graticule is generated, not fetched", () => {
  // Every geometry SPEC-018 needs is produced by a pure function; the relief and
  // the depth bands are derived from the frame already loaded.
  expect(buildGraticule().features.length).toBeGreaterThan(0);
  expect(buildEquator().features).toHaveLength(1);
  expect(cartography).not.toMatch(/\bfetch\s*\(/);
});

test("no committed basemap frame is read or written by this module", () => {
  // NFR-001: SPEC-018 styles what SPEC-004/008 deliver and never touches it.
  expect(cartography).not.toMatch(/public\/basemap/);
  expect(cartography).not.toMatch(/writeFile|readFile/);
});
