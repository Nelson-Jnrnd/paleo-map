// @vitest-environment jsdom
/**
 * SPEC-017 REQ-002/004/007 — the selection side of the fix, at the view level:
 * a selection resolved against the stage rather than the viewport, a search that
 * always lands somewhere real (or explains why not), and cluster semantics
 * disclosed in every mode.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { TaxonPanel } from "../../src/app/components/GroupedPanels.js";
import { fixtureApi } from "./app-harness.js";
import {
  currentMap,
  disableFakeCanvas,
  enableFakeCanvas,
  mapCount,
} from "./map-harness.js";

vi.mock("maplibre-gl", async () => {
  const { fakeMapLibreModule } = await import("./map-harness.js");
  return fakeMapLibreModule();
});
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

beforeEach(() => enableFakeCanvas());
afterEach(() => {
  cleanup();
  disableFakeCanvas();
});

async function flushUntil(done: () => boolean, tries = 20): Promise<void> {
  for (let i = 0; i < tries && !done(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Render the app and bring the fake map up so it can report a viewport. */
async function renderApp() {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  await flushUntil(() => mapCount() > 0);
  const map = currentMap();
  await act(async () => {
    map.fire("load");
  });
  await flushUntil(() => map.getLayer("emphasis-bg") !== undefined);
  return { user, map };
}

/**
 * Narrow the viewport so it holds the two Tyrannosaurus points (−75.4, −76.0)
 * and the Triceratops one (−75.4) but excludes Nanotyrannus at −74.9.
 */
async function excludeNanotyrannus(map: ReturnType<typeof currentMap>) {
  map.setBounds({ west: -77, south: 54, east: -75.2, north: 57 });
  await act(async () => {
    map.fire("moveend");
  });
}

async function searchFor(user: ReturnType<typeof userEvent.setup>, q: string) {
  const box = screen.getByRole("combobox", { name: /search a dinosaur/i });
  await user.clear(box);
  await user.type(box, q);
  const option = await screen.findByRole("option", {
    name: new RegExp(q, "i"),
  });
  await user.click(option);
}

test("REQ-002: a taxon outside the viewport still selects, panels and focuses", async () => {
  const { user, map } = await renderApp();
  await excludeNanotyrannus(map);

  await searchFor(user, "Nanotyrannus");

  // The selection resolved against the whole stage, so the panel is there...
  const panel = await screen.findByRole("region", {
    name: /taxon: Nanotyrannus/i,
  });
  expect(panel).toBeInTheDocument();
  // ...and the map is focusing its occurrence, even though it is off-screen.
  const emphasis = map.getSource("emphasis")?.data as GeoJSON.FeatureCollection;
  expect(emphasis.features.map((f) => f.properties?.["id"])).toEqual(["occ:4"]);
});

test("REQ-002: the list stays viewport-linked while the selection does not", async () => {
  const { user, map } = await renderApp();
  await excludeNanotyrannus(map);
  await searchFor(user, "Nanotyrannus");

  // The row is absent from the on-screen list — that list still means
  // "what's in view" (SPEC-010 REQ-004) — but the selection above survived it.
  const list = screen.getByRole("region", { name: /taxa on the map/i });
  expect(within(list).queryByText("Nanotyrannus")).toBeNull();
  expect(within(list).getByText("Tyrannosaurus")).toBeInTheDocument();
});

test("REQ-004: searching a taxon that is not a grouping level explains itself", async () => {
  const { user } = await renderApp();

  // Dinosauria is a Clade, but not one of the curated major groups, and it has
  // no ancestor at all — so there is no group to select.
  await searchFor(user, "Dinosauria");

  expect(
    await screen.findByText(/isn’t a level the map groups by/i),
  ).toBeInTheDocument();
  // And it did not silently strand a selection.
  expect(screen.queryByRole("region", { name: /taxon:/i })).toBeNull();
});

test("REQ-004: the panel discloses a substituted ancestor", () => {
  render(
    <TaxonPanel
      group={{
        key: "c:titano",
        taxonId: "c:titano",
        name: "Titanosauria",
        occurrenceIds: ["o1"],
        count: 1,
        minMa: 66,
        maxMa: 72,
        notClassified: false,
      }}
      onOpenProfile={() => {}}
      hasArticle={() => true}
      onClose={() => {}}
      substitutedFrom="Aeolosaurini"
    />,
  );
  const panel = screen.getByRole("region", { name: /taxon: Titanosauria/i });
  expect(within(panel).getByRole("status")).toHaveTextContent(
    /Showing Titanosauria, the nearest group the map plots by that contains Aeolosaurini/i,
  );
});

test("REQ-002: the panel counts occurrences at the age, not in the viewport", () => {
  render(
    <TaxonPanel
      group={{
        key: "g:trex",
        taxonId: "g:trex",
        name: "Tyrannosaurus",
        occurrenceIds: ["o1", "o2"],
        count: 2,
        minMa: 66,
        maxMa: 72,
        notClassified: false,
      }}
      onOpenProfile={() => {}}
      hasArticle={() => true}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Occurrences at this age")).toBeInTheDocument();
});

test("REQ-007: cluster semantics are disclosed in all three modes", async () => {
  const { user } = await renderApp();
  const modes = within(
    await screen.findByRole("group", { name: /group occurrences by/i }),
  );

  // Occurrence mode (the default).
  expect(
    screen.getByText(/Clusters count fossil records/i),
  ).toBeInTheDocument();

  await user.click(modes.getByRole("button", { name: "Localities" }));
  expect(
    screen.getByText(/clusters count how many localities/i),
  ).toBeInTheDocument();

  // Taxon mode used to hide the note entirely while still drawing clusters.
  await user.click(modes.getByRole("button", { name: "Taxa" }));
  expect(
    screen.getByText(/Clusters count fossil records/i),
  ).toBeInTheDocument();
});

test("REQ-007: with a taxon focused the note says the count is unfiltered", async () => {
  const { user } = await renderApp();
  const modes = within(
    await screen.findByRole("group", { name: /group occurrences by/i }),
  );
  await user.click(modes.getByRole("button", { name: "Taxa" }));

  const list = screen.getByRole("region", { name: /taxa on the map/i });
  await user.click(within(list).getByRole("button", { name: /Tyrannosaurus/ }));

  expect(
    screen.getByText(/still includes the dimmed records/i),
  ).toBeInTheDocument();
});
