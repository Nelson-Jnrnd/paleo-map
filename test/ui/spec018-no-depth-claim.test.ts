// @vitest-environment jsdom
/**
 * SPEC-018 UX-002 — the map must not imply data it does not have. The depth
 * gradation is a cartographic device derived from distance to the coastline. It
 * is not measured bathymetry, and nothing in the UI may say or suggest that it
 * is. This is the largest risk the spec carries, so it is asserted rather than
 * trusted.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const cartography = readFileSync(
  "src/app/components/mapCartography.ts",
  "utf8",
);
const map = readFileSync("src/app/components/OccurrenceMap.tsx", "utf8");
/** The standing reconstruction label lives on the exploration view (SPEC-007). */
const exploration = readFileSync(
  "src/app/components/ExplorationView.tsx",
  "utf8",
);

/** Any user-visible string literal in a source file. */
function stringLiterals(src: string): string[] {
  return (src.match(/"[^"\n]{3,}"/g) ?? []).map((s) => s.slice(1, -1));
}

test("no depth scale, unit, or measurement is rendered anywhere", () => {
  const forbidden =
    /\b(metres?|meters?|fathoms?|sea level|depth (?:scale|legend|of)|isobath|bathymetr)/i;
  for (const src of [cartography, map, exploration]) {
    for (const literal of stringLiterals(src)) {
      expect(literal).not.toMatch(forbidden);
    }
  }
});

test("no legend entry exists for water depth", () => {
  // The map's legend covers clade markers only (SPEC-015). If a depth legend is
  // ever added, this fails — which is the point.
  expect(map).not.toMatch(/legend[^\n]*\b(depth|shelf|slope|bathym)/i);
});

test("the standing reconstruction label is retired, not merely hidden", () => {
  // SPEC-021 UX-003 (owner disposition A, 2026-08-14): the banner is deleted with
  // no compensating carrier, and FONC-300, CONS-120 and FONC-1130 are retired with
  // it (SPEC-018 AMEND-002). This asserts the deletion so the label cannot be
  // reintroduced by accident — the reconstruction detail now lives only in the
  // basemap attribution popover, which this file does not govern.
  expect(exploration).not.toMatch(/Paleogeographic reconstruction/i);
});

test("land relief carries no meaning — it is distance to the coast, not data", () => {
  // The relief is derived from the coastline geometry alone. It encodes no
  // elevation, no terrain and no measurement, and nothing labels it as such.
  expect(cartography).toMatch(/coastline-distance|distance to the coast/i);
  expect(cartography).not.toMatch(/\b(elevation|terrain|altitude|topograph)/i);
});
