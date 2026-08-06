// @vitest-environment jsdom
/**
 * SPEC-017 DATA-001 + NFR-002 — the taxonomy indexes. Correct membership,
 * chains bounded at the scope root, cycles and dangling parents terminating
 * safely, and construction that visits each taxon a bounded number of times
 * rather than re-scanning per lookup.
 */

import { expect, test } from "vitest";
import type { ReadTaxon } from "../../src/domain/index.js";
import {
  buildTaxonomyIndex,
  relatedness,
} from "../../src/app/state/taxonomy.js";

const taxon = (
  id: string,
  name: string,
  rank: ReadTaxon["rank"],
  parentId: string | null,
): ReadTaxon =>
  ({
    id,
    scientificName: name,
    rank,
    parentId,
    validity: {
      value: "Valid",
      editorial: false,
      sourceId: "ref:1",
      provenance: { approximate: false, missing: false },
    },
  }) as unknown as ReadTaxon;

/**
 * A miniature of the real tree: a stem above Dinosauria (out of scope), two
 * major branches, an avian branch inside Theropoda, and a childless genus.
 */
const fixture: ReadTaxon[] = [
  taxon("t:life", "Life", "Clade", null),
  taxon("t:arch", "Archosauria", "Clade", "t:life"),
  taxon("t:dino", "Dinosauria", "Clade", "t:arch"),
  taxon("t:thero", "Theropoda", "Clade", "t:dino"),
  taxon("t:tyr", "Tyrannosauridae", "Family", "t:thero"),
  taxon("t:trex", "Tyrannosaurus", "Genus", "t:tyr"),
  taxon("t:albo", "Albertosaurus", "Genus", "t:tyr"),
  taxon("t:aves", "Aves", "Clade", "t:thero"),
  taxon("t:bird", "Brodavis", "Genus", "t:aves"),
  taxon("t:orni", "Ornithischia", "Clade", "t:dino"),
  taxon("t:cera", "Ceratopsidae", "Family", "t:orni"),
  taxon("t:trike", "Triceratops", "Genus", "t:cera"),
];

const index = buildTaxonomyIndex(fixture);

test("scope is the Dinosauria subtree — the stem above it is excluded", () => {
  expect(index.rootId).toBe("t:dino");
  expect(index.inScope("t:dino")).toBe(true);
  expect(index.inScope("t:trex")).toBe(true);
  expect(index.inScope("t:arch")).toBe(false);
  expect(index.inScope("t:life")).toBe(false);
  expect(index.scope.size).toBe(10);
});

test("children are in-scope, largest branch first, and exclude the parent", () => {
  // Ordering by what a branch holds, not by name: alphabetical order buries
  // Ornithischia and Saurischia among Dinosauria's one-genus eggshell and
  // footprint families in the real snapshot.
  expect(index.children("t:dino").map((t) => t.scientificName)).toEqual([
    "Theropoda", // 3 genera
    "Ornithischia", // 1
  ]);
  expect(index.children("t:trex")).toEqual([]);
});

test("children ordering falls back to name when two branches are the same size", () => {
  const tied = buildTaxonomyIndex([
    taxon("t:dino", "Dinosauria", "Clade", null),
    taxon("t:b", "Bravoclade", "Clade", "t:dino"),
    taxon("t:a", "Alphaclade", "Clade", "t:dino"),
    taxon("t:bg", "Bravosaurus", "Genus", "t:b"),
    taxon("t:ag", "Alphasaurus", "Genus", "t:a"),
  ]);
  expect(tied.children("t:dino").map((t) => t.scientificName)).toEqual([
    "Alphaclade",
    "Bravoclade",
  ]);
});

test("ancestor chains start at Dinosauria and never walk above it", () => {
  expect(index.ancestors("t:trex").map((t) => t.scientificName)).toEqual([
    "Dinosauria",
    "Theropoda",
    "Tyrannosauridae",
    "Tyrannosaurus",
  ]);
  // Out of scope → no chain at all, rather than a partial one.
  expect(index.ancestors("t:arch")).toEqual([]);
});

test("descendant genus counts sum consistently down the tree", () => {
  expect(index.descendantGenera("t:dino")).toBe(4); // trex, albo, bird, trike
  expect(index.descendantGenera("t:thero")).toBe(3);
  expect(index.descendantGenera("t:orni")).toBe(1);
  expect(index.descendantGenera("t:trex")).toBe(1); // a genus counts itself
  expect(
    index.descendantGenera("t:thero") + index.descendantGenera("t:orni"),
  ).toBe(index.descendantGenera("t:dino"));
});

test("avian branches are identified, and are a subset of the scope", () => {
  expect(index.isAvian("t:aves")).toBe(true);
  expect(index.isAvian("t:bird")).toBe(true);
  expect(index.isAvian("t:trex")).toBe(false);
  for (const id of index.avian) expect(index.scope.has(id)).toBe(true);
});

test("a cycle terminates rather than hanging", () => {
  const cyclic = [
    taxon("t:dino", "Dinosauria", "Clade", null),
    taxon("t:a", "A", "Clade", "t:dino"),
    taxon("t:b", "B", "Clade", "t:a"),
  ];
  // Close the loop: A's parent becomes B.
  (cyclic[1] as { parentId: string }).parentId = "t:b";
  const cyclicIndex = buildTaxonomyIndex(cyclic);
  expect(() => cyclicIndex.ancestors("t:b")).not.toThrow();
  expect(cyclicIndex.ancestors("t:b").length).toBeLessThan(64);
  expect(() => cyclicIndex.descendantGenera("t:dino")).not.toThrow();
});

test("a dangling parentId ends the chain instead of throwing", () => {
  const dangling = [
    taxon("t:dino", "Dinosauria", "Clade", null),
    taxon("t:x", "Orphan", "Genus", "t:missing"),
  ];
  const orphanIndex = buildTaxonomyIndex(dangling);
  expect(orphanIndex.inScope("t:x")).toBe(false);
  expect(orphanIndex.ancestors("t:x")).toEqual([]);
});

test("a snapshot with no Dinosauria yields an empty scope, not a crash", () => {
  const none = buildTaxonomyIndex([taxon("t:life", "Life", "Clade", null)]);
  expect(none.rootId).toBeNull();
  expect(none.scope.size).toBe(0);
  expect(none.ancestors("t:life")).toEqual([]);
});

test("NFR-002: construction visits each taxon a bounded number of times", () => {
  // Two passes to build the maps, plus one visit per node per traversal (scope,
  // and each avian root). Bounded by a small constant times the taxon count —
  // asserted by counter, not by wall-clock timing.
  expect(index.stats.taxa).toBe(fixture.length);
  expect(index.stats.visits).toBeLessThanOrEqual(fixture.length * 6);
});

test("NFR-002: repeated genus lookups are memoised, not re-walked", () => {
  const first = index.genera("t:dino");
  expect(index.genera("t:dino")).toBe(first); // same array identity
});

test("REQ-003: last common ancestor is the deepest shared node", () => {
  const rel = relatedness(index, "t:trex", "t:trike");
  expect(rel.kind).toBe("convergence");
  expect(rel.ancestor?.scientificName).toBe("Dinosauria");
  expect(rel.stepsA).toBe(3); // Theropoda → Tyrannosauridae → Tyrannosaurus
  expect(rel.stepsB).toBe(3); // Ornithischia → Ceratopsidae → Triceratops
});

test("REQ-003: two close relatives converge immediately", () => {
  const rel = relatedness(index, "t:trex", "t:albo");
  expect(rel.ancestor?.scientificName).toBe("Tyrannosauridae");
  expect(rel.stepsA).toBe(1);
  expect(rel.stepsB).toBe(1);
});

test("REQ-003: an ancestor-descendant pair is containment, not convergence", () => {
  const rel = relatedness(index, "t:thero", "t:trex");
  expect(rel.kind).toBe("containment");
  expect(rel.ancestor?.scientificName).toBe("Theropoda");
});

test("REQ-003: comparing a taxon with itself is zero branchings, not an error", () => {
  const rel = relatedness(index, "t:trex", "t:trex");
  expect(rel.kind).toBe("same");
  expect(rel.stepsA).toBe(0);
  expect(rel.stepsB).toBe(0);
});

test("REQ-003: an out-of-scope taxon yields no relationship", () => {
  expect(relatedness(index, "t:trex", "t:arch").kind).toBe("unrelated");
});
