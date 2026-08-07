// @vitest-environment jsdom
/**
 * SPEC-017 REQ-002/004/006/007, UX-001/002 — the taxonomy surfaces render from
 * the loaded model: the clade sheet, the descent, the neighbours, the avian
 * coverage marker, and every defined state.
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReadProfile, ReadTaxon } from "../../src/domain/index.js";
import { buildTaxonomyIndex } from "../../src/app/state/taxonomy.js";
import {
  CladeSheet,
  LineageDescent,
  TaxonNeighbours,
} from "../../src/app/components/TaxonomySurfaces.js";
import type { TaxonomyDeps } from "../../src/app/components/TaxonomySurfaces.js";

afterEach(cleanup);

const taxon = (
  id: string,
  name: string,
  rank: string,
  parentId: string | null,
): ReadTaxon =>
  ({ id, scientificName: name, rank, parentId }) as unknown as ReadTaxon;

const fixture: ReadTaxon[] = [
  taxon("t:arch", "Archosauria", "Clade", null),
  taxon("t:dino", "Dinosauria", "Clade", "t:arch"),
  taxon("t:thero", "Theropoda", "Clade", "t:dino"),
  taxon("t:tyr", "Tyrannosauridae", "Family", "t:thero"),
  taxon("t:trex", "Tyrannosaurus", "Genus", "t:tyr"),
  taxon("t:albo", "Albertosaurus", "Genus", "t:tyr"),
  taxon("t:aves", "Aves", "Clade", "t:thero"),
  taxon("t:bird", "Brodavis", "Genus", "t:aves"),
];

const index = buildTaxonomyIndex(fixture);

function deps(
  onOpenTaxon = vi.fn(),
): TaxonomyDeps & { onOpenTaxon: typeof onOpenTaxon } {
  return {
    index,
    profileOf: (id) =>
      ({
        taxonId: id,
        silhouette: `data/sil/${id}.svg`,
      }) as unknown as ReadProfile,
    onOpenTaxon,
  };
}

/* REQ-002 — clade sheet ---------------------------------------------------- */

test("the sheet renders one silhouette per descendant genus, with the count", () => {
  render(<CladeSheet taxonId="t:dino" deps={deps()} />);
  expect(screen.getByText("3 genera")).toBeInTheDocument();
  for (const name of ["Tyrannosaurus", "Albertosaurus", "Brodavis"]) {
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByAltText(`Silhouette of ${name}`)).toBeInTheDocument();
  }
});

test("activating a sheet entry navigates to that taxon", async () => {
  const onOpen = vi.fn();
  render(<CladeSheet taxonId="t:dino" deps={deps(onOpen)} />);
  await userEvent.click(screen.getByText("Tyrannosaurus"));
  expect(onOpen).toHaveBeenCalledWith("t:trex");
});

test("UX-002: a taxon with no descendant genera renders a labelled empty state", () => {
  render(<CladeSheet taxonId="t:trex" deps={deps()} />);
  expect(screen.getByText(/contains no genera below it/i)).toBeInTheDocument();
});

test("a missing silhouette is labelled, never substituted with a relative's", () => {
  const noSilhouette: TaxonomyDeps = { ...deps(), profileOf: () => undefined };
  render(<CladeSheet taxonId="t:tyr" deps={noSilhouette} />);
  expect(
    screen.getByLabelText("No silhouette for Tyrannosaurus"),
  ).toBeInTheDocument();
  expect(screen.queryByAltText(/^Silhouette of/)).not.toBeInTheDocument();
});

/* REQ-004 — descent -------------------------------------------------------- */

test("the descent renders the whole chain from Dinosauria, with nothing elided", () => {
  render(<LineageDescent taxonId="t:trex" deps={deps()} />);
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(4);
  expect(items.map((li) => li.textContent)).toEqual([
    expect.stringContaining("Dinosauria"),
    expect.stringContaining("Theropoda"),
    expect.stringContaining("Tyrannosauridae"),
    expect.stringContaining("Tyrannosaurus"),
  ]);
  expect(screen.queryByText("⋯")).not.toBeInTheDocument();
});

test("milestones are illustrated and every node stays navigable", async () => {
  const onOpen = vi.fn();
  render(<LineageDescent taxonId="t:trex" deps={deps(onOpen)} />);
  // Dinosauria and Theropoda are declared milestones, so they carry silhouettes.
  expect(screen.getByAltText("Silhouette of Dinosauria")).toBeInTheDocument();
  expect(screen.getByAltText("Silhouette of Theropoda")).toBeInTheDocument();
  // A non-milestone node is still present and clickable.
  await userEvent.click(
    screen.getByRole("button", { name: "Tyrannosauridae" }),
  );
  expect(onOpen).toHaveBeenCalledWith("t:tyr");
});

test("UX-002: an out-of-scope taxon gets a labelled state, not a partial chain", () => {
  render(<LineageDescent taxonId="t:arch" deps={deps()} />);
  expect(screen.getByText(/sits outside Dinosauria/i)).toBeInTheDocument();
});

/* REQ-007 — neighbours ----------------------------------------------------- */

test("neighbours show parent, siblings and children with genus counts", () => {
  render(<TaxonNeighbours taxonId="t:tyr" deps={deps()} />);
  expect(screen.getByText("Theropoda")).toBeInTheDocument(); // parent
  expect(screen.getByText("Aves")).toBeInTheDocument(); // sibling
  expect(screen.getByText("Tyrannosaurus")).toBeInTheDocument(); // child
  expect(screen.getByText("Albertosaurus")).toBeInTheDocument();
  expect(screen.getAllByText(/\d+ genera/).length).toBeGreaterThan(0);
});

test("a neighbour navigates in one action", async () => {
  const onOpen = vi.fn();
  render(<TaxonNeighbours taxonId="t:tyr" deps={deps(onOpen)} />);
  await userEvent.click(screen.getByText("Theropoda"));
  expect(onOpen).toHaveBeenCalledWith("t:thero");
});

test("UX-002: the scope root has no parent, and a leaf has no children", () => {
  const { unmount } = render(
    <TaxonNeighbours taxonId="t:dino" deps={deps()} />,
  );
  expect(screen.getByText(/root of the atlas's taxonomy/i)).toBeInTheDocument();
  unmount();

  render(<TaxonNeighbours taxonId="t:trex" deps={deps()} />);
  expect(screen.getByText(/tip of the tree/i)).toBeInTheDocument();
});

/* REQ-006 — avian marking -------------------------------------------------- */

test("avian taxa are shown and marked; non-avian taxa never are", () => {
  render(<CladeSheet taxonId="t:dino" deps={deps()} />);
  // Brodavis (avian) is present rather than hidden…
  expect(screen.getByText("Brodavis")).toBeInTheDocument();
  // …and exactly one entry carries the marker.
  const marks = screen.getAllByText(/outside\s.*coverage/i);
  expect(marks).toHaveLength(1);
});

test("REQ-006: the marker states coverage, not exclusion from Dinosauria", () => {
  render(<CladeSheet taxonId="t:dino" deps={deps()} />);
  const mark = screen.getByText(/outside\s.*coverage/i);
  expect(mark.textContent).toMatch(/coverage/i);
  expect(mark.textContent).not.toMatch(
    /not a dinosaur|excluded from Dinosauria/i,
  );
  // The full explanation is available as text, not by styling alone (NFR-003).
  expect(mark.getAttribute("title")).toMatch(/inside Dinosauria/i);
});

/* UX-001 — charter --------------------------------------------------------- */

test("UX-001: scientific names are italicised and no product-speak appears", () => {
  const { container } = render(<CladeSheet taxonId="t:dino" deps={deps()} />);
  expect(container.querySelectorAll(".sciName").length).toBeGreaterThan(0);
  expect(container.textContent).not.toMatch(
    /\b(Insights|Overview|Engagement|Activity|items|records)\b/,
  );
});
