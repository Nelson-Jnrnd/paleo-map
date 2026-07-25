/**
 * SPEC-013 REQ-002/003 — taxon search ranking. Case-insensitive matching over
 * scientific + common names; prefix beats substring; ties break by notability
 * (contentLevel) then name; results are capped and short queries return nothing.
 */

import { expect, test } from "vitest";
import {
  searchTaxa,
  stageForTaxon,
  tierForRank,
  type SearchableTaxon,
  type StageBound,
} from "../../src/app/state/search.js";

const INDEX: SearchableTaxon[] = [
  {
    taxonId: "t:trex",
    scientificName: "Tyrannosaurus",
    commonName: "T. rex",
    contentLevel: "FeaturedSpecies",
  },
  {
    taxonId: "t:tarbo",
    scientificName: "Tarbosaurus",
    commonName: null,
    contentLevel: "ShortProfile",
  },
  {
    taxonId: "t:alberto",
    scientificName: "Albertosaurus",
    commonName: null,
    contentLevel: "OccurrenceOnly",
  },
  {
    taxonId: "t:trice",
    scientificName: "Triceratops",
    commonName: null,
    contentLevel: "DetailedProfile",
  },
];

test("matches a prefix case-insensitively (REQ-002)", () => {
  const r = searchTaxa("tyr", INDEX);
  expect(r[0]?.taxonId).toBe("t:trex");
});

test("matches a common name (REQ-002)", () => {
  const r = searchTaxa("rex", INDEX);
  expect(r.map((x) => x.taxonId)).toContain("t:trex");
});

test("too-short query returns nothing (REQ-002)", () => {
  expect(searchTaxa("t", INDEX)).toEqual([]);
  expect(searchTaxa("  ", INDEX)).toEqual([]);
});

test("prefix ranks above substring; notability breaks ties (REQ-003)", () => {
  // "saurus": Tyrannosaurus/Tarbosaurus/Albertosaurus all contain it mid-string
  // (quality 1). Order is by notability: Featured(t:trex) > Short(t:tarbo) >
  // Occurrence(t:alberto). Triceratops does not match.
  const r = searchTaxa("saurus", INDEX).map((x) => x.taxonId);
  expect(r).toEqual(["t:trex", "t:tarbo", "t:alberto"]);

  // A prefix match must outrank a substring match regardless of notability.
  const r2 = searchTaxa("tar", INDEX);
  expect(r2[0]?.taxonId).toBe("t:tarbo"); // prefix, beats none here
});

test("tierForRank maps a taxon rank to its grouping tier (REQ-004)", () => {
  expect(tierForRank("Genus")).toBe("genus");
  expect(tierForRank("Family")).toBe("family");
  expect(tierForRank("Clade")).toBe("majorGroup");
  expect(tierForRank("Species")).toBe("genus"); // default
});

test("stageForTaxon keeps or moves the age into the taxon's range (REQ-004)", () => {
  // Older bound = larger Ma.
  const stages: StageBound[] = [
    { name: "Norian", startMa: 227, endMa: 208.5 },
    { name: "Campanian", startMa: 83.6, endMa: 72.1 },
    { name: "Maastrichtian", startMa: 72.1, endMa: 66 },
  ];
  // Current age already overlaps the taxon's span → keep it.
  expect(stageForTaxon({ minMa: 68, maxMa: 70 }, "Maastrichtian", stages)).toBe(
    "Maastrichtian",
  );
  // Current age misses the span → jump to the overlapping stage.
  expect(
    stageForTaxon({ minMa: 210, maxMa: 220 }, "Maastrichtian", stages),
  ).toBe("Norian");
  // Unknown span → keep the current age (no invented jump).
  expect(stageForTaxon(null, "Campanian", stages)).toBe("Campanian");
});

test("respects the result cap", () => {
  const many: SearchableTaxon[] = Array.from({ length: 20 }, (_, i) => ({
    taxonId: `t:${i}`,
    scientificName: `Saurus${i}`,
    commonName: null,
    contentLevel: "OccurrenceOnly",
  }));
  expect(searchTaxa("saurus", many, 8).length).toBe(8);
});
