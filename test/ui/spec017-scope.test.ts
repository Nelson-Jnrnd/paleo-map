// @vitest-environment node
/**
 * SPEC-017 REQ-001 — the scope boundary, asserted against the **shipped
 * snapshot** rather than a fixture. This is the regression guard from the spec's
 * test plan: if a snapshot regeneration changes the tree's shape, these numbers
 * move and the build fails loudly instead of the surfaces quietly changing
 * meaning.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { ReadTaxon } from "../../src/domain/index.js";
import { buildTaxonomyIndex } from "../../src/app/state/taxonomy.js";

const reference = JSON.parse(
  readFileSync("public/data/reference.json", "utf8"),
) as {
  taxa: ReadTaxon[];
  profiles: { taxonId: string; silhouette?: string }[];
};

const index = buildTaxonomyIndex(reference.taxa);
const idOf = (name: string): string =>
  reference.taxa.find((t) => t.scientificName === name)!.id;

test("the Dinosauria subtree holds 2,521 of the snapshot's 2,555 taxa", () => {
  expect(reference.taxa).toHaveLength(2555);
  expect(index.scope.size).toBe(2521);
});

test("the 34-node stem above Dinosauria is out of scope", () => {
  expect(reference.taxa.length - index.scope.size).toBe(34);
  for (const name of ["Life", "Chordata", "Amniota", "Archosauria"]) {
    expect(index.inScope(idOf(name))).toBe(false);
  }
});

test("Dinosauria → Tyrannosaurus is 11 nodes, rooted at the scope root", () => {
  const chain = index.ancestors(idOf("Tyrannosaurus"));
  expect(chain).toHaveLength(11);
  expect(chain[0]!.scientificName).toBe("Dinosauria");
  expect(chain.at(-1)!.scientificName).toBe("Tyrannosaurus");
});

test("no ancestor chain ever leaves the Dinosauria subtree", () => {
  for (const name of ["Triceratops", "Velociraptor", "Diplodocus"]) {
    for (const node of index.ancestors(idOf(name))) {
      expect(index.inScope(node.id)).toBe(true);
    }
  }
});

test("avian branches are in scope and account for 351 taxa", () => {
  expect(index.avian.size).toBe(351);
  expect(index.scope.size - index.avian.size).toBe(2170);
  expect(index.isAvian(idOf("Aves"))).toBe(true);
  expect(index.isAvian(idOf("Tyrannosaurus"))).toBe(false);
});

test("every in-scope taxon has a committed silhouette — no new assets needed", () => {
  const silhouetteFor = new Map(
    reference.profiles.map((p) => [p.taxonId, p.silhouette]),
  );
  const missing = [...index.scope].filter((id) => !silhouetteFor.get(id));
  expect(missing).toEqual([]);
});

test("the largest branches are the ones the spec sized the fan against", () => {
  expect(index.descendantGenera(idOf("Theropoda"))).toBeGreaterThan(
    index.descendantGenera(idOf("Ornithischia")),
  );
  expect(index.descendantGenera(index.rootId!)).toBe(2123);
});
