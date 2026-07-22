/**
 * SPEC-009 REQ-003 / NFR-001 — the viewport bounds filter. Pure in-memory helpers:
 * `withinBounds` (incl. antimeridian wrap) and `occurrencesInView` (mirrors the
 * map's placeable points; null bounds ⇒ the full set).
 */
import { expect, test } from "vitest";
import {
  occurrencesInView,
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

test("occurrencesInView with null bounds returns the full set (no map signal)", () => {
  const list = [occ("a", { lng: 1, lat: 1 }), occ("b", null)];
  expect(occurrencesInView(list, null).map((o) => o.id)).toEqual(["a", "b"]);
});
