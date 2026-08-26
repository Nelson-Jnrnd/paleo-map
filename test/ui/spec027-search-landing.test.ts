/**
 * SPEC-027 REQ-004 — a search must land on a group the map can actually produce.
 *
 * Rank alone cannot decide this: `groupByTaxon`'s Major-group tier keys only on
 * the 17 curated `MAJOR_GROUP_NAMES`, while the shipped snapshot carries 285
 * clades. Landing on one of the other 268 used to select a key no group could
 * match, so mode, rank and stage all changed and nothing was selected.
 */
import { expect, test } from "vitest";
import type { ReadTaxon } from "../../src/domain/index.js";
import { indexTaxaById, tierOfTaxon } from "../../src/app/state/grouping.js";
import { landingForTaxon } from "../../src/app/state/search.js";

function taxon(
  id: string,
  name: string,
  rank: ReadTaxon["rank"],
  parentId?: string,
): ReadTaxon {
  return {
    id,
    scientificName: name,
    rank,
    ...(parentId ? { parentId } : {}),
    validity: {
      value: "Valid",
      sourceId: "s",
      editorial: false,
      provenance: { approximate: false, missing: false },
    },
    acceptedPer: "ref",
  };
}

// Aeolosaurini is a real snapshot clade that is *not* a major group; Titanosauria
// above it is. Dinosauria is a clade but also not a curated major group.
const TAXA = indexTaxaById([
  taxon("g:trex", "Tyrannosaurus", "Genus", "f:tyr"),
  taxon("f:tyr", "Tyrannosauridae", "Family", "c:thero"),
  taxon("c:thero", "Theropoda", "Clade", "c:dino"),
  taxon("c:aeolo", "Aeolosaurini", "Clade", "c:titano"),
  taxon("c:titano", "Titanosauria", "Clade", "c:dino"),
  taxon("c:dino", "Dinosauria", "Clade"),
]);

test("tierOfTaxon knows which taxa can key a group at all", () => {
  expect(tierOfTaxon(TAXA.get("g:trex") as ReadTaxon)).toBe("genus");
  expect(tierOfTaxon(TAXA.get("f:tyr") as ReadTaxon)).toBe("family");
  expect(tierOfTaxon(TAXA.get("c:thero") as ReadTaxon)).toBe("majorGroup");
  // A clade outside the curated set is not a grouping level at any tier.
  expect(tierOfTaxon(TAXA.get("c:aeolo") as ReadTaxon)).toBeNull();
  expect(tierOfTaxon(TAXA.get("c:dino") as ReadTaxon)).toBeNull();
});

test("a genus lands on itself at the genus tier, with no substitution", () => {
  const landing = landingForTaxon("g:trex", TAXA);
  expect(landing).toEqual({
    taxonKey: "g:trex",
    rank: "genus",
    landedName: "Tyrannosaurus",
    substitutedFrom: null,
  });
});

test("a family lands on itself at the family tier", () => {
  expect(landingForTaxon("f:tyr", TAXA)?.rank).toBe("family");
  expect(landingForTaxon("f:tyr", TAXA)?.substitutedFrom).toBeNull();
});

test("a curated major group lands on itself", () => {
  const landing = landingForTaxon("c:thero", TAXA);
  expect(landing?.taxonKey).toBe("c:thero");
  expect(landing?.rank).toBe("majorGroup");
  expect(landing?.substitutedFrom).toBeNull();
});

test("a non-major-group clade substitutes its nearest eligible ancestor (REQ-004)", () => {
  const landing = landingForTaxon("c:aeolo", TAXA);
  // Not the searched clade — the nearest ancestor that is a grouping level.
  expect(landing).toEqual({
    taxonKey: "c:titano",
    rank: "majorGroup",
    landedName: "Titanosauria",
    // ...and it reports what was searched, so the panel can disclose it.
    substitutedFrom: "Aeolosaurini",
  });
});

test("returns null when no ancestor is a grouping level, so the caller can explain", () => {
  expect(landingForTaxon("c:dino", TAXA)).toBeNull();
});

test("an unknown taxon id resolves to nothing", () => {
  expect(landingForTaxon("g:nope", TAXA)).toBeNull();
});

test("a cyclic parent chain terminates instead of looping", () => {
  const cyclic = indexTaxaById([
    taxon("c:a", "Aclade", "Clade", "c:b"),
    taxon("c:b", "Bclade", "Clade", "c:a"),
  ]);
  expect(landingForTaxon("c:a", cyclic)).toBeNull();
});
