/**
 * SPEC-010 REQ-005 / DATA-002 — the ancestor-at-tier resolver over the ingested
 * parent chain, including missing-ancestor (not-classified) and closed-chain
 * (no dangling parent) behaviour. Also verifies the fixture snapshot actually
 * carries a resolvable multi-rank hierarchy (DATA-003).
 */
import { describe, expect, it } from "vitest";
import type { ReadTaxon } from "../../src/domain/index.js";
import {
  indexTaxaById,
  resolveTierTaxon,
} from "../../src/app/state/grouping.js";
import { mesozoicModel } from "./app-harness.js";

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

const CHAIN = indexTaxaById([
  taxon("g:trex", "Tyrannosaurus", "Genus", "f:tyr"),
  taxon("f:tyr", "Tyrannosauridae", "Family", "c:thero"),
  taxon("c:thero", "Theropoda", "Clade", "c:dino"),
  taxon("c:dino", "Dinosauria", "Clade"),
]);

describe("SPEC-010 REQ-005: resolveTierTaxon", () => {
  it("returns the taxon itself when it is already at the tier", () => {
    expect(resolveTierTaxon("g:trex", "genus", CHAIN)?.scientificName).toBe("Tyrannosaurus");
  });

  it("walks up to the family and the major-group clade", () => {
    expect(resolveTierTaxon("g:trex", "family", CHAIN)?.scientificName).toBe("Tyrannosauridae");
    expect(resolveTierTaxon("g:trex", "majorGroup", CHAIN)?.scientificName).toBe("Theropoda");
  });

  it("returns null when no ancestor sits at the tier (record above it)", () => {
    // Theropoda has no Genus ancestor → not classified at the genus tier.
    expect(resolveTierTaxon("c:thero", "genus", CHAIN)).toBeNull();
  });

  it("returns null for a taxon absent from the snapshot", () => {
    expect(resolveTierTaxon("g:absent", "genus", CHAIN)).toBeNull();
  });

  it("does not loop on a cyclic chain", () => {
    const cyclic = indexTaxaById([
      taxon("a", "A", "Genus", "b"),
      taxon("b", "B", "Family", "a"),
    ]);
    expect(resolveTierTaxon("a", "majorGroup", cyclic)).toBeNull();
  });
});

describe("SPEC-010 DATA-003: the fixture snapshot carries a resolvable hierarchy", () => {
  it("resolves a genus up to its family and major group", async () => {
    const model = await mesozoicModel();
    const taxa = indexTaxaById(model.taxa);
    const family = resolveTierTaxon("txn:tyrannosaurus", "family", taxa);
    const major = resolveTierTaxon("txn:tyrannosaurus", "majorGroup", taxa);
    expect(family?.scientificName).toBe("Tyrannosauridae");
    expect(major?.scientificName).toBe("Theropoda");
    // The chain is closed: every non-root parentId resolves inside the taxa set.
    for (const t of model.taxa) {
      if (t.parentId) expect(taxa.has(t.parentId)).toBe(true);
    }
  });
});
