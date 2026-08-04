// @vitest-environment jsdom
/**
 * SPEC-017 REQ-001/003/005/006 + NFR-001 — what the map is told to draw when a
 * selection is active. Driven through the fake MapLibre in `map-harness.ts`,
 * because these are assertions about source data, layer paint and camera calls
 * rather than about pixels.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  OccurrenceMap,
  sameCounts,
  sameLabels,
} from "../../src/app/components/OccurrenceMap.js";
import type { ReadOccurrence } from "../../src/domain/index.js";
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

function occurrence(
  id: string,
  taxonId: string,
  lng: number,
  lat: number,
): ReadOccurrence {
  const provenance = { approximate: false, missing: false };
  return {
    id,
    taxonId,
    taxonName: taxonId,
    collectionId: `col:${id}`,
    collectionName: `Collection ${id}`,
    formation: null,
    timeRange: {
      value: { minMa: 66, maxMa: 72 },
      sourceId: "s",
      editorial: false,
      provenance,
    },
    paleoPosition: {
      value: {
        palaeoLng: lng,
        palaeoLat: lat,
        rotationModel: "SCOTESE",
        reconstructionAgeMa: 69,
      },
      sourceId: "s",
      editorial: false,
      provenance,
    },
    modernPosition: {
      value: { lng, lat },
      sourceId: "s",
      editorial: false,
      provenance,
    },
  } as unknown as ReadOccurrence;
}

// Two taxa, far apart: A in the western hemisphere, B in the east.
const OCCS: ReadOccurrence[] = [
  occurrence("o1", "t:a", -100, 45),
  occurrence("o2", "t:a", -95, 40),
  occurrence("o3", "t:b", 110, -20),
  occurrence("o4", "t:b", 115, -25),
];

// Stable identities, as the real caller (`ExplorationView`) memoises them. Since
// AMEND-001 the component no longer *needs* this — see the settling test at the
// bottom — but passing stable props keeps each test's re-render count honest.
const NO_LOCALITIES: never[] = [];
const NO_TAXA = new Map();

/** Pump the event loop inside `act` until a condition holds (or we give up). */
async function flushUntil(done: () => boolean, tries = 20): Promise<void> {
  for (let i = 0; i < tries && !done(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Render the map and let its async `load` handler finish adding layers. */
async function renderMap(props: Record<string, unknown> = {}) {
  const view = render(
    <OccurrenceMap
      occurrences={OCCS}
      selectedId={null}
      onSelect={() => {}}
      occurrenceRotationModel="SCOTESE"
      stageName="Maastrichtian"
      localities={NO_LOCALITIES}
      taxaById={NO_TAXA}
      {...props}
    />,
  );
  // The component imports maplibre lazily, so the map appears a microtask or
  // two after render; its `load` work (icon decode) then resolves on more.
  await flushUntil(() => mapCount() > 0);
  const map = currentMap();
  await act(async () => {
    map.fire("load");
  });
  await flushUntil(() => map.getLayer("emphasis-bg") !== undefined);
  return { view, map };
}

function emphasisIds(map: ReturnType<typeof currentMap>): string[] {
  const data = map.getSource("emphasis")?.data as GeoJSON.FeatureCollection;
  return data.features.map((f) => String(f.properties?.["id"]));
}

test("REQ-001: with no focus the overlay is empty and nothing is dimmed", async () => {
  const { map } = await renderMap();
  expect(emphasisIds(map)).toEqual([]);
  expect(map.getLayer("clusters")?.paint["circle-opacity"]).toBe(1);
  expect(map.getLayer("points-bg")?.paint["circle-opacity"]).toBe(1);
});

test("REQ-001: focusing a taxon fills the overlay and dims the whole base", async () => {
  const { map } = await renderMap({ focusIds: ["o1", "o2"] });

  // The focused occurrences are drawn unclustered, above everything.
  expect(emphasisIds(map).sort()).toEqual(["o1", "o2"]);

  // ...and the base recedes — the cluster layers included, which is the whole
  // point: emphasis painted only on the unclustered layers was invisible.
  for (const [layer, prop] of [
    ["clusters", "circle-opacity"],
    ["clusters", "circle-stroke-opacity"],
    ["clusters-icon", "icon-opacity"],
    ["points-bg", "circle-opacity"],
    ["points-icon", "icon-opacity"],
  ] as const) {
    expect(map.getLayer(layer)?.paint[prop]).toBe(0.2);
  }
});

test("REQ-001: the clustered source still holds every occurrence when focused", async () => {
  const { map } = await renderMap({ focusIds: ["o1"] });
  const base = map.getSource("occurrences")?.data as GeoJSON.FeatureCollection;
  // SPEC-010 REQ-004: taxon focus never removes points from the map.
  expect(base.features).toHaveLength(OCCS.length);
  expect(map.getSource("emphasis")?.options["cluster"]).toBe(false);
});

test("REQ-001: a selection with no taxon focus is emphasised without dimming", async () => {
  // SPEC-009's ring was on the unclustered layer only, so selecting an
  // occurrence inside a cluster showed nothing. It now joins the overlay —
  // but a mere selection/hover must not recede the whole map (focus is stronger).
  const { map } = await renderMap({ selectedId: "o3", highlightedId: "o1" });
  expect(emphasisIds(map).sort()).toEqual(["o1", "o3"]);
  expect(map.getLayer("clusters")?.paint["circle-opacity"]).toBe(1);
});

test("NFR-001: changing the focus never re-feeds the clustered source", async () => {
  const { view, map } = await renderMap({ focusIds: ["o1"] });
  const baseFeeds = map.getSource("occurrences")?.setDataCalls.length ?? 0;

  view.rerender(
    <OccurrenceMap
      occurrences={OCCS}
      selectedId={null}
      onSelect={() => {}}
      occurrenceRotationModel="SCOTESE"
      stageName="Maastrichtian"
      localities={NO_LOCALITIES}
      taxaById={NO_TAXA}
      focusIds={["o3", "o4"]}
    />,
  );

  // The overlay is re-fed; re-clustering 5k–9k points is not.
  expect(map.getSource("occurrences")?.setDataCalls.length).toBe(baseFeeds);
  expect(emphasisIds(map).sort()).toEqual(["o3", "o4"]);
});

test("REQ-003: a search landing frames the focus exactly once", async () => {
  // Camera starts on the whole world, so the eastern taxon is >50% in view;
  // narrow the viewport to the west so a fit is actually warranted.
  const { view, map } = await renderMap({ focusIds: ["o3", "o4"] });
  map.setBounds({ west: -140, south: 10, east: -60, north: 70 });

  const rerenderWith = (fitToken: number) =>
    view.rerender(
      <OccurrenceMap
        occurrences={OCCS}
        selectedId={null}
        onSelect={() => {}}
        occurrenceRotationModel="SCOTESE"
        stageName="Maastrichtian"
        localities={NO_LOCALITIES}
        taxaById={NO_TAXA}
        focusIds={["o3", "o4"]}
        focusOccurrences={OCCS.filter((o) => o.taxonId === "t:b")}
        fitToken={fitToken}
      />,
    );

  rerenderWith(1);
  expect(map.fitBoundsCalls).toHaveLength(1);
  const [[west, south], [east, north]] = (
    map.fitBoundsCalls[0] as { bounds: [number[], number[]] }
  ).bounds as unknown as [[number, number], [number, number]];
  expect(west).toBe(110);
  expect(east).toBe(115);
  expect(south).toBe(-25);
  expect(north).toBe(-20);

  // A re-render that does not bump the token must not move the camera again.
  rerenderWith(1);
  expect(map.fitBoundsCalls).toHaveLength(1);
});

test("REQ-003: no fit when the taxon is already substantially in view", async () => {
  const { view, map } = await renderMap();
  map.setBounds({ west: -180, south: -85, east: 180, north: 85 });
  view.rerender(
    <OccurrenceMap
      occurrences={OCCS}
      selectedId={null}
      onSelect={() => {}}
      occurrenceRotationModel="SCOTESE"
      stageName="Maastrichtian"
      localities={NO_LOCALITIES}
      taxaById={NO_TAXA}
      focusIds={["o1", "o2"]}
      focusOccurrences={OCCS.filter((o) => o.taxonId === "t:a")}
      fitToken={1}
    />,
  );
  expect(map.fitBoundsCalls).toHaveLength(0);
});

test("REQ-003: the fit waits for the landed stage's occurrences", async () => {
  const { view, map } = await renderMap();
  map.setBounds({ west: -140, south: 10, east: -60, north: 70 });

  const rerenderWith = (focus: ReadOccurrence[]) =>
    view.rerender(
      <OccurrenceMap
        occurrences={OCCS}
        selectedId={null}
        onSelect={() => {}}
        occurrenceRotationModel="SCOTESE"
        stageName="Maastrichtian"
        localities={NO_LOCALITIES}
        taxaById={NO_TAXA}
        focusIds={focus.map((o) => o.id)}
        focusOccurrences={focus}
        fitToken={1}
      />,
    );

  // Token bumped while the stage is still loading: nothing to frame yet.
  rerenderWith([]);
  expect(map.fitBoundsCalls).toHaveLength(0);

  // Occurrences arrive — the pending fit now runs, without a second token.
  rerenderWith(OCCS.filter((o) => o.taxonId === "t:b"));
  expect(map.fitBoundsCalls).toHaveLength(1);
});

test("REQ-006: locality mode gets no clade silhouette on its clusters", async () => {
  const { map } = await renderMap({
    mode: "locality",
    localities: [
      {
        collectionId: "col:o1",
        name: "A",
        formation: null,
        paleo: {
          palaeoLng: -100,
          palaeoLat: 45,
          rotationModel: "SCOTESE",
          reconstructionAgeMa: 69,
        },
        occurrenceIds: ["o1"],
        taxonIds: ["t:a"],
        taxonCount: 1,
        minMa: 66,
        maxMa: 72,
      },
    ],
  });
  expect(map.getLayer("clusters-icon")?.layout["visibility"]).toBe("none");
});

test("REQ-005: in taxon mode a species row selects the taxon, not the profile", async () => {
  const onSelectTaxon = vi.fn();
  const onOpenProfile = vi.fn();
  const { map } = await renderMap({
    mode: "taxon",
    onSelectTaxon,
    onOpenProfile,
  });

  // A cluster of two co-located taxa under the pointer.
  map.rendered.set("clusters", [
    {
      properties: { cluster_id: 3, point_count: 2 },
      geometry: { type: "Point", coordinates: [-100, 45] },
    },
  ]);
  const source = map.getSource("occurrences");
  if (source) {
    source.getClusterLeaves = () =>
      Promise.resolve([
        {
          geometry: { type: "Point", coordinates: [-100, 45] },
          properties: { taxonId: "t:a", taxon: "Taxon A", iconKey: "other" },
        },
        {
          geometry: { type: "Point", coordinates: [-100, 45] },
          properties: { taxonId: "t:b", taxon: "Taxon B", iconKey: "other" },
        },
      ]);
  }

  await act(async () => {
    map.fire("click", { point: { x: 10, y: 10 } });
  });
  await flushUntil(() => screen.queryAllByRole("dialog").length > 0);

  await act(async () => {
    screen.getByRole("button", { name: "Select Taxon A" }).click();
  });

  expect(onSelectTaxon).toHaveBeenCalledWith("t:a");
  expect(onOpenProfile).not.toHaveBeenCalled();
});

test("REQ-005: a locality cluster click zooms instead of opening a species card", async () => {
  const { map } = await renderMap({ mode: "locality", localities: [] });
  // A cluster under the pointer, no point features.
  map.rendered.set("clusters", [
    {
      properties: { cluster_id: 7, point_count: 12 },
      geometry: { type: "Point", coordinates: [-100, 45] },
    },
  ]);

  await act(async () => {
    map.fire("click", { point: { x: 10, y: 10 } });
    await Promise.resolve();
  });

  // It zooms, and never consults the (taxon-shaped) cluster leaves.
  expect(map.easeToCalls).toHaveLength(1);
});

test("AMEND-001: the map settles when a caller omits the collection props", async () => {
  // The regression: `localities`/`taxaById` defaulted to fresh objects each
  // render, so the data-sync effect re-ran every pass and `updateOverlays` set
  // two array states with new identities — feeding itself forever. This render
  // (no `localities`, no `taxaById`) used to hang the suite outright.
  const view = render(
    <OccurrenceMap
      occurrences={OCCS}
      selectedId={null}
      onSelect={() => {}}
      occurrenceRotationModel="SCOTESE"
      stageName="Maastrichtian"
    />,
  );
  await flushUntil(() => mapCount() > 0);
  const map = currentMap();
  await act(async () => {
    map.fire("load");
  });
  await flushUntil(() => map.getLayer("emphasis-bg") !== undefined);

  // One effect run == one overlay setData, so an unsettled component shows up as
  // an unbounded call count. Give it plenty of slack and still expect a handful.
  const feeds = () => map.getSource("emphasis")?.setDataCalls.length ?? 0;
  const afterMount = feeds();
  await flushUntil(() => false, 5); // pump the loop; nothing should accumulate
  expect(feeds()).toBe(afterMount);
  expect(afterMount).toBeLessThan(10);

  view.unmount();
}, 15_000);

test("AMEND-001: a map event that changes nothing does not re-render", async () => {
  const { map } = await renderMap();
  const feeds = () => map.getSource("emphasis")?.setDataCalls.length ?? 0;
  const before = feeds();
  // `moveend` recomputes the overlays; with no clusters rendered and no zoom
  // change the derived values are identical, so state must keep its identity.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      map.fire("moveend");
    });
  }
  expect(feeds()).toBe(before);
});

/*
 * The predicates behind the settling behaviour, tested directly. The integration
 * test above is the real guarantee, but a regression there manifests as a hang
 * inside React's `act`; these fail fast and say which half broke.
 */

test("AMEND-001: sameCounts compares by value, not identity", () => {
  const a = [{ key: "c1", x: 10, y: 20, count: 5 }];
  expect(sameCounts(a, [{ key: "c1", x: 10, y: 20, count: 5 }])).toBe(true);
  expect(sameCounts(a, [{ key: "c1", x: 10, y: 21, count: 5 }])).toBe(false);
  expect(sameCounts(a, [{ key: "c1", x: 10, y: 20, count: 6 }])).toBe(false);
  expect(sameCounts(a, [{ key: "c2", x: 10, y: 20, count: 5 }])).toBe(false);
  expect(sameCounts(a, [])).toBe(false);
  expect(sameCounts([], [])).toBe(true);
});

test("AMEND-001: sameLabels compares by value, not identity", () => {
  const a = [{ id: "o1", taxon: "Tyrannosaurus", x: 5, y: 6 }];
  expect(
    sameLabels(a, [{ id: "o1", taxon: "Tyrannosaurus", x: 5, y: 6 }]),
  ).toBe(true);
  expect(
    sameLabels(a, [{ id: "o2", taxon: "Tyrannosaurus", x: 5, y: 6 }]),
  ).toBe(false);
  expect(sameLabels(a, [{ id: "o1", taxon: "Triceratops", x: 5, y: 6 }])).toBe(
    false,
  );
  expect(
    sameLabels(a, [{ id: "o1", taxon: "Tyrannosaurus", x: 5, y: 7 }]),
  ).toBe(false);
  expect(sameLabels([], [])).toBe(true);
});
