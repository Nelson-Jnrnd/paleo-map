/**
 * SPEC-015 REQ-001/REQ-003 — clade marker resolution + hover card content. The
 * map picks a bounded clade icon + tint from a taxon's major group, and the hover
 * preview surfaces name · clade · age · formation before any click. Pure and
 * map-free.
 */

import { expect, test } from "vitest";
import type { ReadOccurrence, ReadTaxon } from "../../src/domain/index.js";
import {
  cladeMarkerForTaxon,
  FALLBACK_MARKER,
} from "../../src/app/components/mapCladeMarkers.js";
import { hoverCardContent } from "../../src/app/components/MapHoverCard.js";
import { NOT_AVAILABLE } from "../../src/app/format.js";

function taxon(
  id: string,
  scientificName: string,
  rank: string,
  parentId: string | null,
): ReadTaxon {
  return { id, scientificName, rank, parentId } as unknown as ReadTaxon;
}

const TAXA = new Map<string, ReadTaxon>([
  ["c:thero", taxon("c:thero", "Theropoda", "Clade", null)],
  ["c:sauro", taxon("c:sauro", "Sauropoda", "Clade", null)],
  ["g:trex", taxon("g:trex", "Tyrannosaurus", "Genus", "c:thero")],
  ["g:apato", taxon("g:apato", "Apatosaurus", "Genus", "c:sauro")],
  ["g:lone", taxon("g:lone", "Nowhere", "Genus", null)],
]);

test("resolves a genus to its major-group clade marker", () => {
  expect(cladeMarkerForTaxon("g:trex", TAXA).id).toBe("theropod");
  expect(cladeMarkerForTaxon("g:apato", TAXA).id).toBe("sauropod");
});

test("falls back to the neutral marker when no major group resolves", () => {
  expect(cladeMarkerForTaxon("g:lone", TAXA).id).toBe(FALLBACK_MARKER.id);
});

test("every clade marker carries an id, label, src and tint", () => {
  const m = cladeMarkerForTaxon("g:trex", TAXA);
  expect(m.label).toBeTruthy();
  expect(m.src).toBeTruthy();
  expect(m.tint).toMatch(/^#/);
});

function occ(taxonName: string, formation: string | null): ReadOccurrence {
  return {
    id: "o1",
    taxonName,
    formation,
    timeRange: { value: { minMa: 72, maxMa: 66 } },
  } as unknown as ReadOccurrence;
}

test("hover card content carries name, clade, age and formation", () => {
  const c = hoverCardContent(occ("Tyrannosaurus", "Hell Creek"), "Theropod");
  expect(c.taxon).toBe("Tyrannosaurus");
  expect(c.clade).toBe("Theropod");
  expect(c.age).toMatch(/Ma/);
  expect(c.formation).toBe("Hell Creek");
});

test("hover card shows an explicit not-available formation", () => {
  expect(
    hoverCardContent(occ("Tyrannosaurus", null), "Theropod").formation,
  ).toBe(NOT_AVAILABLE);
});
