/**
 * SPEC-010 REQ-003/004 — grouping folds. Pure, no React/canvas: build minimal
 * read occurrences/taxa and assert the locality and taxon aggregates.
 */
import { describe, expect, it } from "vitest";
import type { ReadOccurrence, ReadTaxon } from "../../src/domain/index.js";
import {
  NOT_CLASSIFIED_KEY,
  groupByLocality,
  groupByTaxon,
  indexTaxaById,
} from "../../src/app/state/grouping.js";

function occ(
  id: string,
  taxonId: string,
  collectionId: string,
  minMa: number,
  maxMa: number,
  paleo: { palaeoLat: number; palaeoLng: number } | null = { palaeoLat: 50, palaeoLng: -70 },
): ReadOccurrence {
  const pv = { editorial: false, provenance: { approximate: false, missing: false } };
  return {
    id,
    taxonId,
    taxonName: taxonId,
    collectionId,
    collectionName: `Locality ${collectionId}`,
    formation: `Formation ${collectionId}`,
    member: null,
    modernPosition: { value: { lat: 0, lng: 0, region: "x" }, sourceId: "s", ...pv },
    paleoPosition: {
      value: paleo ? { ...paleo, rotationModel: "scotese" } : null,
      sourceId: "s",
      ...pv,
    },
    timeRange: { value: { minMa, maxMa }, sourceId: "s", ...pv },
  };
}

function taxon(id: string, name: string, rank: ReadTaxon["rank"], parentId?: string): ReadTaxon {
  return {
    id,
    scientificName: name,
    rank,
    ...(parentId ? { parentId } : {}),
    validity: { value: "Valid", sourceId: "s", editorial: false, provenance: { approximate: false, missing: false } },
    acceptedPer: "ref",
  };
}

// Tyrannosaurus, Nanotyrannus → Tyrannosauridae → Theropoda; Triceratops → Ceratopsidae → Ceratopsia.
const TAXA = indexTaxaById([
  taxon("g:trex", "Tyrannosaurus", "Genus", "f:tyr"),
  taxon("g:nano", "Nanotyrannus", "Genus", "f:tyr"),
  taxon("g:tri", "Triceratops", "Genus", "f:cer"),
  taxon("f:tyr", "Tyrannosauridae", "Family", "c:thero"),
  taxon("f:cer", "Ceratopsidae", "Family", "c:cera"),
  taxon("c:thero", "Theropoda", "Clade", "c:dino"),
  taxon("c:cera", "Ceratopsia", "Clade", "c:dino"),
  taxon("c:dino", "Dinosauria", "Clade"),
]);

describe("SPEC-010 REQ-003: groupByLocality", () => {
  it("collapses occurrences sharing a collection into one locality with distinct-taxon count", () => {
    const occurrences = [
      occ("o1", "g:trex", "colA", 66, 68),
      occ("o2", "g:tri", "colA", 66, 68),
      occ("o3", "g:trex", "colA", 67, 70), // same taxon again → still 2 distinct taxa
      occ("o4", "g:tri", "colB", 72, 74),
    ];
    const groups = groupByLocality(occurrences);
    expect(groups.map((g) => g.collectionId)).toEqual(["colA", "colB"]);
    const a = groups[0]!;
    expect(a.occurrenceIds).toEqual(["o1", "o2", "o3"]);
    expect(a.taxonCount).toBe(2);
    expect(a.minMa).toBe(66);
    expect(a.maxMa).toBe(70);
    expect(a.paleo).not.toBeNull();
  });

  it("keeps the collection's own paleocoordinate (never averaged)", () => {
    const groups = groupByLocality([
      occ("o1", "g:trex", "colA", 66, 68, { palaeoLat: 40, palaeoLng: -60 }),
      occ("o2", "g:tri", "colA", 66, 68, { palaeoLat: 40, palaeoLng: -60 }),
    ]);
    expect(groups[0]!.paleo).toMatchObject({ palaeoLat: 40, palaeoLng: -60 });
  });
});

describe("SPEC-010 REQ-004/005: groupByTaxon with rank roll-up", () => {
  const occurrences = [
    occ("o1", "g:trex", "colA", 66, 68),
    occ("o2", "g:nano", "colB", 67, 69),
    occ("o3", "g:tri", "colC", 70, 72),
  ];

  it("groups one row per genus at the genus tier", () => {
    const groups = groupByTaxon(occurrences, "genus", TAXA);
    expect(groups.map((g) => g.name)).toEqual(["Nanotyrannus", "Triceratops", "Tyrannosaurus"]);
    expect(groups.every((g) => g.count === 1)).toBe(true);
  });

  it("rolls two genera into one family at the family tier", () => {
    const groups = groupByTaxon(occurrences, "family", TAXA);
    const tyr = groups.find((g) => g.name === "Tyrannosauridae")!;
    expect(tyr.count).toBe(2); // Tyrannosaurus + Nanotyrannus
    expect(tyr.minMa).toBe(66);
    expect(tyr.maxMa).toBe(69);
    expect(groups.find((g) => g.name === "Ceratopsidae")!.count).toBe(1);
  });

  it("rolls up to the curated major-group clade", () => {
    const groups = groupByTaxon(occurrences, "majorGroup", TAXA);
    expect(groups.find((g) => g.name === "Theropoda")!.count).toBe(2);
    expect(groups.find((g) => g.name === "Ceratopsia")!.count).toBe(1);
  });

  it("buckets records above the tier as not-classified, always last", () => {
    // An occurrence identified only to a clade (Theropoda) cannot roll down to a genus.
    const withIndet = [...occurrences, occ("o4", "c:thero", "colD", 80, 82)];
    const groups = groupByTaxon(withIndet, "genus", TAXA);
    const last = groups[groups.length - 1]!;
    expect(last.notClassified).toBe(true);
    expect(last.key).toBe(NOT_CLASSIFIED_KEY);
    expect(last.count).toBe(1);
    expect(last.name).toMatch(/not classified at genus/i);
  });

  it("buckets a taxon absent from the snapshot as not-classified", () => {
    const groups = groupByTaxon([occ("o1", "g:unknown", "colA", 66, 68)], "genus", TAXA);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.notClassified).toBe(true);
  });
});
