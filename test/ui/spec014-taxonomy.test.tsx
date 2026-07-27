// @vitest-environment jsdom
/**
 * SPEC-014 REQ-006 — the taxonomy tree renders the taxon's lineage from the
 * `parentId` chain, root → … → the taxon, with navigable ancestor links; a taxon
 * with no parent record degrades gracefully (no tree). Pure lineage derivation is
 * cycle-safe.
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { taxonLineage } from "../../src/app/components/lineage.js";
import { TaxonomyTree } from "../../src/app/components/TaxonomyTree.js";
import type { ReadTaxon } from "../../src/domain/index.js";

afterEach(cleanup);

function taxon(
  id: string,
  scientificName: string,
  parentId: string | null,
  rank = "genus",
): ReadTaxon {
  return { id, scientificName, parentId, rank } as unknown as ReadTaxon;
}

const TAXA = new Map<string, ReadTaxon>([
  ["t:dino", taxon("t:dino", "Dinosauria", null, "clade")],
  ["t:thero", taxon("t:thero", "Theropoda", "t:dino", "order")],
  ["t:trex", taxon("t:trex", "Tyrannosaurus", "t:thero", "genus")],
]);

test("taxonLineage returns ancestors root → taxon", () => {
  expect(taxonLineage("t:trex", TAXA).map((t) => t.scientificName)).toEqual([
    "Dinosauria",
    "Theropoda",
    "Tyrannosaurus",
  ]);
});

test("taxonLineage is cycle-safe", () => {
  const cyclic = new Map<string, ReadTaxon>([
    ["a", taxon("a", "A", "b")],
    ["b", taxon("b", "B", "a")],
  ]);
  // Must terminate and not loop forever.
  expect(taxonLineage("a", cyclic).length).toBeLessThanOrEqual(2);
});

test("renders the lineage and navigates on an ancestor click", async () => {
  const onOpen = vi.fn();
  const { default: userEvent } = await import("@testing-library/user-event");
  render(
    <TaxonomyTree taxonId="t:trex" taxaById={TAXA} onOpenTaxon={onOpen} />,
  );

  // Current taxon is present; an ancestor is a button.
  expect(screen.getByText("Dinosauria")).toBeTruthy();
  const ancestor = screen.getByText("Theropoda");
  await userEvent.setup().click(ancestor);
  expect(onOpen).toHaveBeenCalledWith("t:thero");
});

test("a taxon with no ancestry renders no tree", () => {
  const lone = new Map<string, ReadTaxon>([["x", taxon("x", "Loner", null)]]);
  const { container } = render(
    <TaxonomyTree taxonId="x" taxaById={lone} onOpenTaxon={() => {}} />,
  );
  expect(container.firstChild).toBeNull();
});
