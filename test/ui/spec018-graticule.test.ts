// @vitest-environment jsdom
/**
 * SPEC-018 REQ-003 — the graticule. Present at the declared interval, with the
 * equator drawn distinctly, and stacked so it obscures neither coastlines nor
 * markers.
 */

import { expect, test } from "vitest";
import {
  CARTOGRAPHY_LAYER_ORDER,
  EQUATOR,
  GRATICULE,
  GRATICULE_INTERVAL_DEG,
  MERCATOR_LAT_LIMIT,
  buildEquator,
  buildGraticule,
  graticuleLayers,
} from "../../src/app/components/mapCartography.js";

interface Layer {
  id: string;
  source: string;
  paint: Record<string, unknown>;
}

const layers = graticuleLayers("graticule", "equator") as unknown as Layer[];
const grid = buildGraticule();

const coords = (f: GeoJSON.Feature): [number, number][] =>
  (f.geometry as GeoJSON.LineString).coordinates as [number, number][];

test("lines are present at the declared interval across the full extent", () => {
  const meridians = grid.features.filter(
    (f) => f.properties?.["kind"] === "meridian",
  );
  const parallels = grid.features.filter(
    (f) => f.properties?.["kind"] === "parallel",
  );

  // -180…180 inclusive at 30° → 13 meridians.
  expect(meridians).toHaveLength(360 / GRATICULE_INTERVAL_DEG + 1);
  // ±30 and ±60; the equator is drawn separately and ±90 is unrepresentable.
  expect(parallels).toHaveLength(4);

  const lngs = meridians.map((f) => coords(f)[0]![0]).sort((a, b) => a - b);
  expect(lngs[0]).toBe(-180);
  expect(lngs.at(-1)).toBe(180);
  // Math.abs: -180 % 30 is -0 in JS, and Object.is(-0, 0) is false.
  for (const lng of lngs)
    expect(Math.abs(lng % GRATICULE_INTERVAL_DEG)).toBe(0);
});

test("the equator is a separate feature, drawn distinctly from the rest of the grid", () => {
  // Never painted twice at two weights.
  const onZero = grid.features.filter((f) =>
    coords(f).every(([, lat]) => lat === 0),
  );
  expect(onZero).toHaveLength(0);

  const equator = buildEquator();
  expect(equator.features).toHaveLength(1);
  expect(coords(equator.features[0]!).every(([, lat]) => lat === 0)).toBe(true);

  const [gridLayer, equatorLayer] = layers;
  expect(gridLayer!.paint["line-color"]).toBe(GRATICULE);
  expect(equatorLayer!.paint["line-color"]).toBe(EQUATOR);
  expect(gridLayer!.paint["line-color"]).not.toBe(
    equatorLayer!.paint["line-color"],
  );
  expect(equatorLayer!.paint["line-width"] as number).toBeGreaterThan(
    gridLayer!.paint["line-width"] as number,
  );
});

test("lines are densified, not drawn as bare endpoints", () => {
  for (const f of grid.features) expect(coords(f).length).toBeGreaterThan(2);
});

test("meridians stop at the Mercator limit rather than running to the pole", () => {
  for (const f of grid.features.filter(
    (x) => x.properties?.["kind"] === "meridian",
  )) {
    for (const [, lat] of coords(f)) {
      expect(Math.abs(lat)).toBeLessThanOrEqual(MERCATOR_LAT_LIMIT);
    }
  }
});

test("stacked above the ocean, below the coastline, below the markers", () => {
  const order = [...CARTOGRAPHY_LAYER_ORDER];
  const at = (id: string): number => order.indexOf(id as never);

  // Above the ocean bands…
  expect(at("graticule")).toBeGreaterThan(at("ocean-slope"));
  expect(at("graticule")).toBeGreaterThan(at("ocean-shelf"));
  // …and above the land fill, so the grid is legible over continents too — a
  // graticule hidden by Pangaea would defeat the point…
  expect(at("graticule")).toBeGreaterThan(at("land-fill"));
  // …but below the crisp coastline, so it can never obscure one.
  expect(at("graticule-equator")).toBeLessThan(at("land-line"));
});

test("the graticule is generated in-app, with no network target", () => {
  // Sources are local geojson built by buildGraticule/buildEquator.
  expect(layers.map((l) => l.source)).toEqual(["graticule", "equator"]);
});
