/**
 * SPEC-009 REQ-003 / NFR-001 — the viewport bounds filter. Pure in-memory helpers:
 * `withinBounds` (incl. antimeridian wrap) and `occurrencesInView` (mirrors the
 * map's placeable points; null bounds ⇒ the full set).
 *
 * SPEC-017 REQ-003 adds the inverse: `boundsOfPoints` / `fractionInView`, which
 * turn a focused taxon into a camera target and decide whether to move at all.
 */
import { expect, test } from "vitest";
import {
  boundsOfPoints,
  fractionInView,
  occurrencesInView,
  paleoPoints,
  withinBounds,
} from "../../src/app/state/viewport.js";
import type { Bounds } from "../../src/app/state/viewport.js";
import type { ReadOccurrence } from "../../src/domain/index.js";

const BOX: Bounds = { west: -10, south: -10, east: 10, north: 10 };

function occ(
  id: string,
  paleo: { lng: number; lat: number } | null,
): ReadOccurrence {
  return {
    id,
    taxonId: `t-${id}`,
    taxonName: `Taxon ${id}`,
    collectionName: "coll",
    formation: null,
    member: null,
    modernPosition: { value: null, sourceId: "s", provenance: {} },
    paleoPosition: {
      value: paleo ? { palaeoLng: paleo.lng, palaeoLat: paleo.lat } : null,
      sourceId: "s",
      provenance: {},
    },
    timeRange: {
      value: { minMa: 66, maxMa: 72 },
      sourceId: "s",
      provenance: { approximate: false },
    },
  } as unknown as ReadOccurrence;
}

test("withinBounds accepts points inside and rejects points outside", () => {
  expect(withinBounds(0, 0, BOX)).toBe(true);
  expect(withinBounds(10, 10, BOX)).toBe(true); // inclusive edges
  expect(withinBounds(20, 0, BOX)).toBe(false); // east of box
  expect(withinBounds(0, 40, BOX)).toBe(false); // north of box
});

test("withinBounds handles an antimeridian-wrapping viewport (west > east)", () => {
  const wrap: Bounds = { west: 170, south: -10, east: -170, north: 10 };
  expect(withinBounds(175, 0, wrap)).toBe(true); // 170…180 arc
  expect(withinBounds(-175, 0, wrap)).toBe(true); // -180…-170 arc
  expect(withinBounds(0, 0, wrap)).toBe(false); // the gap
});

test("occurrencesInView keeps only placeable points inside the bounds", () => {
  const inside = occ("a", { lng: 1, lat: 1 });
  const outside = occ("b", { lng: 50, lat: 50 });
  const unplaceable = occ("c", null);
  const result = occurrencesInView([inside, outside, unplaceable], BOX);
  expect(result.map((o) => o.id)).toEqual(["a"]);
});

test("occurrencesInView with null bounds lists every placeable occurrence (no map signal)", () => {
  // Unplaceable occurrences are never listed, even in the no-map fallback.
  const list = [occ("a", { lng: 1, lat: 1 }), occ("b", null)];
  expect(occurrencesInView(list, null).map((o) => o.id)).toEqual(["a"]);
});

/* SPEC-017 REQ-003 — deriving a camera target from a point set. */

test("boundsOfPoints encloses every point", () => {
  const b = boundsOfPoints([
    { lng: -100, lat: 45 },
    { lng: -95, lat: 40 },
    { lng: -110, lat: 50 },
  ]);
  expect(b).toEqual({ west: -110, south: 40, east: -95, north: 50 });
});

test("boundsOfPoints takes the shorter arc across the antimeridian", () => {
  // Plain min/max would give west −175 → east 175, framing the whole planet the
  // long way round. The real distribution spans 10° across the dateline.
  const b = boundsOfPoints([
    { lng: 175, lat: 0 },
    { lng: -175, lat: 5 },
  ]);
  expect(b?.west).toBe(175);
  // East is carried past 180 so the arc stays monotonic for the caller.
  expect(b?.east).toBe(185);
  expect((b?.east as number) - (b?.west as number)).toBe(10);
});

test("boundsOfPoints on a single point is a zero-area box (the caller clamps zoom)", () => {
  expect(boundsOfPoints([{ lng: 12, lat: -3 }])).toEqual({
    west: 12,
    south: -3,
    east: 12,
    north: -3,
  });
});

test("boundsOfPoints on nothing is null — there is nothing to frame", () => {
  expect(boundsOfPoints([])).toBeNull();
});

test("paleoPoints drops occurrences with no reconstructed position", () => {
  const points = paleoPoints([occ("a", { lng: 1, lat: 2 }), occ("b", null)]);
  expect(points).toEqual([{ lng: 1, lat: 2 }]);
});

test("fractionInView measures how much of a taxon is already framed", () => {
  const points = [
    { lng: 0, lat: 0 },
    { lng: 5, lat: 5 },
    { lng: 50, lat: 50 },
    { lng: 60, lat: 60 },
  ];
  expect(fractionInView(points, BOX)).toBe(0.5);
  expect(fractionInView([], BOX)).toBe(1); // nothing to move for
  expect(fractionInView(points, null)).toBe(0); // no viewport signal yet
});
