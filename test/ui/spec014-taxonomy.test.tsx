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
  // SPEC-014 AMEND-005: a taxon is navigable in the breadcrumb only when it has a
  // Wikipedia article, so give the default fixtures one.
  return {
    id,
    scientificName,
    parentId,
    rank,
    wikipedia: {
      title: scientificName,
      url: `https://en.wikipedia.org/wiki/${scientificName}`,
    },
  } as unknown as ReadTaxon;
}

/** Same taxon but with no Wikipedia article (AMEND-005: non-navigable crumb). */
function taxonNoArticle(
  id: string,
  scientificName: string,
  parentId: string | null,
): ReadTaxon {
  return {
    id,
    scientificName,
    parentId,
    rank: "clade",
    wikipedia: null,
  } as unknown as ReadTaxon;
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

test("an ancestor without a Wikipedia article is shown but not navigable (AMEND-005)", async () => {
  const onOpen = vi.fn();
  const { default: userEvent } = await import("@testing-library/user-event");
  const taxa = new Map<string, ReadTaxon>([
    ["t:dino", taxon("t:dino", "Dinosauria", null, "clade")],
    ["t:thero", taxonNoArticle("t:thero", "Theropoda", "t:dino")],
    ["t:trex", taxon("t:trex", "Tyrannosaurus", "t:thero", "genus")],
  ]);
  render(
    <TaxonomyTree taxonId="t:trex" taxaById={taxa} onOpenTaxon={onOpen} />,
  );

  const ancestor = screen.getByText("Theropoda");
  // It is not a button, and clicking it does nothing.
  expect(ancestor.closest("button")).toBeNull();
  await userEvent.setup().click(ancestor);
  expect(onOpen).not.toHaveBeenCalled();
});

test("a taxon with no ancestry renders no tree", () => {
  const lone = new Map<string, ReadTaxon>([["x", taxon("x", "Loner", null)]]);
  const { container } = render(
    <TaxonomyTree taxonId="x" taxaById={lone} onOpenTaxon={() => {}} />,
  );
  expect(container.firstChild).toBeNull();
});
