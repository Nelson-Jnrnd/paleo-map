/**
 * SPEC-010 REQ-003/004 — grouping folds. Pure, no React/canvas: build minimal
 * read occurrences/taxa and assert the locality and taxon aggregates.
 */
import { describe, expect, it } from "vitest";
import type { ReadOccurrence, ReadTaxon } from "../../src/domain/index.js";
import {
  groupByLocality,
  classifiesAt,
  groupByTaxon,
  indexTaxaById,
} from "../../src/app/state/grouping.js";

function occ(
  id: string,
  taxonId: string,
  collectionId: string,
  minMa: number,
  maxMa: number,
  paleo: { palaeoLat: number; palaeoLng: number } | null = {
    palaeoLat: 50,
    palaeoLng: -70,
  },
): ReadOccurrence {
  const pv = {
    editorial: false,
    provenance: { approximate: false, missing: false },
  };
  return {
    id,
    taxonId,
    taxonName: taxonId,
    collectionId,
    collectionName: `Locality ${collectionId}`,
    formation: `Formation ${collectionId}`,
    member: null,
    modernPosition: {
      value: { lat: 0, lng: 0, region: "x" },
      sourceId: "s",
      ...pv,
    },
    paleoPosition: {
      value: paleo ? { ...paleo, rotationModel: "scotese" } : null,
      sourceId: "s",
      ...pv,
    },
    timeRange: { value: { minMa, maxMa }, sourceId: "s", ...pv },
  };
}

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
    expect(groups.map((g) => g.name)).toEqual([
      "Nanotyrannus",
      "Triceratops",
      "Tyrannosaurus",
    ]);
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

  it("excludes records that do not classify at the tier (SPEC-026 REQ-004)", () => {
    // An occurrence identified only to a clade (Theropoda) cannot roll down to a
    // genus. Before SPEC-026 it went into a trailing "not classified" bucket;
    // the owner instructed that the bucket be filtered out of the taxon units
    // (2026-08-14). The record is untouched at the Occurrence and Locality
    // units — it is excluded from *this* unit, not from the atlas.
    const withIndet = [...occurrences, occ("o4", "c:thero", "colD", 80, 82)];
    const groups = groupByTaxon(withIndet, "genus", TAXA);
    expect(groups.every((g) => Boolean(g.taxonId))).toBe(true);
    expect(groups.some((g) => /not classified/i.test(g.name))).toBe(false);
    // The classified groups are unaffected by the record's presence.
    expect(groups).toEqual(groupByTaxon(occurrences, "genus", TAXA));
  });

  it("yields no group at all when nothing classifies at the tier", () => {
    const groups = groupByTaxon(
      [occ("o1", "g:unknown", "colA", 66, 68)],
      "genus",
      TAXA,
    );
    expect(groups).toHaveLength(0);
  });

  it("classifiesAt is the predicate the unit filters by", () => {
    const indet = occ("o4", "c:thero", "colD", 80, 82);
    expect(classifiesAt(indet, "genus", TAXA)).toBe(false);
    expect(classifiesAt(occurrences[0]!, "genus", TAXA)).toBe(true);
  });

  it("orders taxon groups by count descending, then name (SPEC-026 REQ-005)", () => {
    // The render cap makes the order decide what is *not* shown, so the busiest
    // groups must come first rather than the alphabetically luckiest.
    const groups = groupByTaxon(occurrences, "genus", TAXA);
    const counts = groups.map((g) => g.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});
