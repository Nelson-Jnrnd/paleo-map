// @vitest-environment jsdom
/**
 * SPEC-017 REQ-003/005, NFR-001/003, UX-002 — the dedicated taxonomy screen:
 * the comparison surface and its wording constraint, the fan and its textual
 * equivalent, the out-of-scope state, keyboard operability, and rendering with
 * no network at all.
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReadModel, ReadTaxon } from "../../src/domain/index.js";
import { ReadApi } from "../../src/read/api.js";
import { TaxonomyScreen } from "../../src/app/components/TaxonomyScreen.js";

afterEach(cleanup);

const taxon = (
  id: string,
  name: string,
  rank: string,
  parentId: string | null,
): ReadTaxon =>
  ({ id, scientificName: name, rank, parentId }) as unknown as ReadTaxon;

const taxa: ReadTaxon[] = [
  taxon("t:arch", "Archosauria", "Clade", null),
  taxon("t:dino", "Dinosauria", "Clade", "t:arch"),
  taxon("t:thero", "Theropoda", "Clade", "t:dino"),
  taxon("t:tyr", "Tyrannosauridae", "Family", "t:thero"),
  taxon("t:trex", "Tyrannosaurus", "Genus", "t:tyr"),
  taxon("t:orni", "Ornithischia", "Clade", "t:dino"),
  taxon("t:cera", "Ceratopsidae", "Family", "t:orni"),
  taxon("t:trike", "Triceratops", "Genus", "t:cera"),
];

const model = {
  metadata: {},
  taxa,
  profiles: taxa.map((t) => ({
    taxonId: t.id,
    silhouette: `data/sil/${t.id}.svg`,
    contentLevel: "DetailedProfile",
    commonName: null,
  })),
  occurrences: [],
  sources: {},
} as unknown as ReadModel;

const api = ReadApi.fromModel(model);

function renderScreen(taxonId: string | null = "t:trex", onBack = vi.fn()) {
  return {
    onBack,
    ...render(
      <TaxonomyScreen
        api={api}
        taxonId={taxonId}
        onBack={onBack}
        onSelectTaxon={vi.fn()}
      />,
    ),
  };
}

/* REQ-003 — comparison ----------------------------------------------------- */

test("comparing two taxa names the meeting point and counts branchings on each arm", async () => {
  renderScreen("t:trex");
  await userEvent.type(
    screen.getByRole("searchbox", { name: /second taxon/i }),
    "Trice",
  );
  await userEvent.click(screen.getByRole("button", { name: "Triceratops" }));

  const compare = screen.getByRole("region", { name: /compare two taxa/i });
  expect(within(compare).getByText(/lineages meet at/i)).toBeInTheDocument();
  expect(within(compare).getAllByText("Dinosauria").length).toBeGreaterThan(0);
  // Both arms are 3 branchings from Dinosauria.
  expect(within(compare).getAllByText(/3 branchings/)).toHaveLength(2);
});

test("REQ-003: the comparison never expresses elapsed time", async () => {
  renderScreen("t:trex");
  await userEvent.type(
    screen.getByRole("searchbox", { name: /second taxon/i }),
    "Trice",
  );
  await userEvent.click(screen.getByRole("button", { name: "Triceratops" }));

  const compare = screen.getByRole("region", { name: /compare two taxa/i });
  // Scan the *claims*, not the disclaimer: the note deliberately uses temporal
  // words to say the surface is not making a temporal claim.
  const note = within(compare).getByRole("note");
  const claims = Array.from(compare.querySelectorAll("p, li"))
    .filter((el) => !note.contains(el))
    .map((el) => el.textContent ?? "")
    .join(" ");
  // No duration, no date, no Ma value — the chain is containment, not a dated
  // phylogeny, so any temporal phrasing would be a claim the data cannot support.
  expect(claims).not.toMatch(/\bMa\b|million years|myr|\bago\b|diverged/i);
  expect(claims).toMatch(/branchings/);
  // And the limitation is stated on the surface, not left implicit.
  expect(within(compare).getByRole("note").textContent).toMatch(
    /not how long ago/i,
  );
});

test("UX-002: the comparison surface has a defined empty state", () => {
  renderScreen("t:trex");
  const compare = screen.getByRole("region", { name: /compare two taxa/i });
  expect(
    within(compare).getByText(/search for a second taxon/i),
  ).toBeInTheDocument();
});

/* REQ-005 — fan ------------------------------------------------------------ */

test("the fan renders wedges and an equivalent list for assistive tech", () => {
  renderScreen("t:trex");
  const fan = screen.getByRole("region", { name: /shape of dinosauria/i });
  expect(
    within(fan).getByRole("img", { name: /radial tree/i }),
  ).toBeInTheDocument();
  // NFR-003: the geometry has a textual equivalent, which doubles as the way an
  // unlabelled wedge stays identifiable.
  expect(within(fan).getByText(/branches, as a list/i)).toBeInTheDocument();
  expect(within(fan).getAllByText(/\d+ (genus|genera)/).length).toBeGreaterThan(
    0,
  );
});

/* REQ-001 / UX-002 — scope boundary ---------------------------------------- */

test("UX-002: an out-of-scope taxon falls back to the root and says so", () => {
  renderScreen("t:arch");
  expect(screen.getByText(/sits above/i)).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 1, name: "Dinosauria" }),
  ).toBeInTheDocument();
});

test("a null focus opens at the scope root", () => {
  renderScreen(null);
  expect(
    screen.getByRole("heading", { level: 1, name: "Dinosauria" }),
  ).toBeInTheDocument();
});

/* Navigation --------------------------------------------------------------- */

test("one action returns to the map (OQ-040)", async () => {
  const onBack = vi.fn();
  renderScreen("t:trex", onBack);
  await userEvent.click(screen.getByRole("button", { name: /back to map/i }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

/* NFR-003 — accessibility -------------------------------------------------- */

test("NFR-003: every surface is a labelled region and every entry is a button", () => {
  renderScreen("t:trex");
  const regions = screen.getAllByRole("region");
  expect(regions.length).toBeGreaterThanOrEqual(4);
  for (const region of regions) {
    expect(region.getAttribute("aria-label")).toBeTruthy();
  }
  // Navigable entries are real buttons, so they are keyboard-reachable.
  expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
});

test("NFR-003: silhouettes carry their taxon's name as an accessible name", () => {
  renderScreen("t:trex");
  expect(screen.getAllByAltText(/^Silhouette of /).length).toBeGreaterThan(0);
});

/* NFR-001 — offline -------------------------------------------------------- */

test("NFR-001: the screen renders with the network stubbed to fail", () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("no network in this test"));
  renderScreen("t:trex");
  expect(
    screen.getByRole("heading", { level: 1, name: "Tyrannosaurus" }),
  ).toBeInTheDocument();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
