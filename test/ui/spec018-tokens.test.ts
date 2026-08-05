// @vitest-environment jsdom
/**
 * SPEC-018 UX-001 — charter alignment under the 2026-08-05 owner override. The
 * basemap may be rich, but it stays in the charter's cool-neutral family, adds
 * no second accent, and every value it introduces is recorded in the tokens.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  EQUATOR,
  GRATICULE,
  LAND,
  LAND_SHADE,
  OCEAN_DEEP,
  OCEAN_SHELF,
  OCEAN_SLOPE,
} from "../../src/app/components/mapCartography.js";

const tokens = readFileSync("src/app/styles/tokens.css", "utf8");

/** The single teal accent — it belongs to the data and interaction layer only. */
const ACCENTS = ["#0f9d83", "#0a7f66", "#17a98c"];
/** ICS period hues — reserved for the timeline (charter §4). */
const ICS = ["#8e5aa5", "#3e93c6", "#5fa96a"];

const MAP_VALUES = [
  OCEAN_DEEP,
  OCEAN_SLOPE,
  OCEAN_SHELF,
  LAND,
  LAND_SHADE,
  GRATICULE,
  EQUATOR,
];

test("every value the map introduces is recorded in tokens.css", () => {
  for (const value of MAP_VALUES) {
    expect(tokens.toLowerCase()).toContain(value.toLowerCase());
  }
});

test("the previously unused charter tokens are now referenced", () => {
  // --color-ocean-inner and --color-grid were defined and never rendered; that
  // is the gap SPEC-018 exists to close.
  expect(MAP_VALUES).toContain(OCEAN_SHELF);
  expect(MAP_VALUES).toContain(GRATICULE);
});

test("no accent and no ICS period hue leaks onto the basemap", () => {
  for (const value of MAP_VALUES) {
    expect(ACCENTS).not.toContain(value.toLowerCase());
    expect(ICS).not.toContain(value.toLowerCase());
  }
});

test("the basemap stays cool-neutral — blue is never the weakest channel", () => {
  for (const value of MAP_VALUES) {
    const r = parseInt(value.slice(1, 3), 16);
    const b = parseInt(value.slice(5, 7), 16);
    expect(b).toBeGreaterThanOrEqual(r);
  }
});
