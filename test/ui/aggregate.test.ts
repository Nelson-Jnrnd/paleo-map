/**
 * SPEC-005 REQ-001/002, NFR-001 — pure grouping + viewport helpers.
 */

import { expect, test } from "vitest";
import {
  groupOccurrences,
  inViewport,
  withinBounds,
} from "../../src/app/state/aggregate.js";
import { buildReadModel } from "../../src/pipeline/build.js";
import { FixtureSourceClient } from "../../src/pipeline/fixture-client.js";
import { ReadApi } from "../../src/read/api.js";
import type { ReadOccurrence } from "../../src/domain/index.js";

async function occurrences(): Promise<ReadOccurrence[]> {
  const api = ReadApi.fromModel(
    await buildReadModel(new FixtureSourceClient()),
  );
  return api.listOccurrences({ stage: "Maastrichtian" });
}

test("groups by taxon with counts, sorted by count desc then label", async () => {
  const groups = groupOccurrences(await occurrences(), "taxon");
  const summary = groups.map((g) => [g.label, g.occurrences.length] as const);
  // Triceratops (2) and Tyrannosaurus (2) tie → alphabetical; Nanotyrannus (1) last.
  expect(summary).toEqual([
    ["Triceratops", 2],
    ["Tyrannosaurus", 2],
    ["Nanotyrannus", 1],
  ]);
  expect(groups[0]!.taxonId).toBe("txn:triceratops");
});

test("groups by formation", async () => {
  const groups = groupOccurrences(await occurrences(), "formation");
  expect(groups[0]).toMatchObject({
    label: "Hell Creek Formation",
    taxonId: null,
  });
  expect(groups[0]!.occurrences.length).toBe(3);
  expect(groups.map((g) => g.label)).toContain("Lance Formation");
});

test("withinBounds respects lat/lng and antimeridian wrap", () => {
  const na = { west: -90, south: 40, east: -60, north: 70 };
  expect(withinBounds(-75.4, 55.2, na)).toBe(true);
  expect(withinBounds(10, 55.2, na)).toBe(false);
  // Wrapped viewport crossing the antimeridian.
  const wrap = { west: 170, south: -10, east: -170, north: 10 };
  expect(withinBounds(175, 0, wrap)).toBe(true);
  expect(withinBounds(0, 0, wrap)).toBe(false);
});

test("inViewport narrows to bounds but always keeps unplaceable occurrences", async () => {
  const occs = await occurrences();
  // A tight box far from the data excludes all mappable occurrences.
  const far = { west: 0, south: -80, east: 10, north: -70 };
  const kept = inViewport(occs, far);
  // Only the occurrence with no paleoposition (Lance) survives (REQ-002).
  expect(kept).toHaveLength(1);
  expect(kept[0]!.paleoPosition.value).toBeNull();
  // A null viewport returns everything.
  expect(inViewport(occs, null)).toHaveLength(occs.length);
});
