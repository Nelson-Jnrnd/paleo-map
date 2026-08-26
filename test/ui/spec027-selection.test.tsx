// @vitest-environment jsdom
/**
 * SPEC-027 REQ-002/004 — the selection side of the fix, at the view level: a
 * selection resolved against the stage rather than the viewport, and a search
 * that always lands somewhere real (or explains why not).
 *
 * Written against the SPEC-026 sidebar: one five-unit selector ("One row per"),
 * one `UnitList` named "<Unit> on the map", and a detail that *replaces* that
 * list rather than stacking above it.
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

/** A taxon-group fixture in the post-SPEC-026 shape (no not-classified bucket). */
function group(name: string, count: number) {
  return {
    key: `k:${name}`,
    taxonId: `t:${name}`,
    name,
    occurrenceIds: Array.from({ length: count }, (_, i) => `o${i}`),
    count,
    minMa: 66,
    maxMa: 72,
  };
}

test("REQ-002: a taxon outside the viewport still selects, panels and focuses", async () => {
  const { user, map } = await renderApp();
  await excludeNanotyrannus(map);

  await searchFor(user, "Nanotyrannus");

  // The selection resolved against the whole stage, so the detail is there...
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

  // The detail replaced the list (SPEC-026 REQ-003), so step back to it and
  // confirm the off-viewport taxon is still absent from what's "on the map".
  await user.click(screen.getByRole("button", { name: /^← / }));
  const list = screen.getByRole("region", { name: /on the map/i });
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
      group={group("Titanosauria", 1)}
      onOpenProfile={() => {}}
      hasArticle={() => true}
      onClose={() => {}}
      backLabel="Major groups on the map"
      clade="Sauropod"
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
      group={group("Tyrannosaurus", 2)}
      onOpenProfile={() => {}}
      hasArticle={() => true}
      onClose={() => {}}
      backLabel="Genera on the map"
      clade="Theropod"
    />,
  );
  expect(screen.getByText("Occurrences at this age")).toBeInTheDocument();
});

test("REQ-002: switching unit keeps the selection resolvable at the new tier", async () => {
  const { user } = await renderApp();
  const units = within(
    screen.getByRole("radiogroup", { name: /one row per/i }),
  );

  // Genus unit, select from the list, then step up to Family.
  await user.click(units.getByRole("radio", { name: "Genus" }));
  const list = screen.getByRole("region", { name: /on the map/i });
  await user.click(within(list).getByRole("button", { name: /Tyrannosaurus/ }));
  expect(
    screen.getByRole("region", { name: /taxon: Tyrannosaurus/i }),
  ).toBeInTheDocument();

  // SPEC-010 REQ-005 drops the selection on a rank change; the list returns
  // rather than a stale panel or a blank column.
  await user.click(units.getByRole("radio", { name: "Family" }));
  expect(screen.queryByRole("region", { name: /taxon:/i })).toBeNull();
  expect(
    screen.getByRole("region", { name: /on the map/i }),
  ).toBeInTheDocument();
});
