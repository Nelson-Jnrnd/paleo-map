// @vitest-environment jsdom
/**
 * SPEC-009 REQ-003/004, UX-001 — the viewport-linked occurrence list: renders the
 * on-screen occurrences with an in-view count, reports hover for the map cross-
 * highlight, marks the selected row, bounds the DOM with an overflow affordance,
 * shows a recoverable empty-in-view state, and restores the keyboard path
 * row → occurrence panel → taxon profile that SPEC-007 removed.
 */
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LIST_RENDER_CAP,
  OccurrenceList,
} from "../../src/app/components/OccurrenceList.js";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";
import type { ReadOccurrence } from "../../src/domain/index.js";

afterEach(cleanup);

function occ(id: string, taxon: string, approximate = false): ReadOccurrence {
  return {
    id,
    taxonId: `t-${id}`,
    taxonName: taxon,
    collectionName: "coll",
    formation: null,
    member: null,
    modernPosition: { value: null, sourceId: "s", provenance: {} },
    paleoPosition: {
      value: { palaeoLng: 0, palaeoLat: 0 },
      sourceId: "s",
      provenance: {},
    },
    timeRange: {
      value: { minMa: 66, maxMa: 72 },
      sourceId: "s",
      provenance: { approximate },
    },
  } as unknown as ReadOccurrence;
}

function noop(): void {}

test("lists the in-view occurrences and states the in-view count", () => {
  render(
    <OccurrenceList
      occurrences={[occ("a", "Tyrannosaurus rex"), occ("b", "Triceratops")]}
      totalAtAge={5}
      viewportActive={true}
      selectedId={null}
      highlightedId={null}
      onSelect={noop}
      onHover={noop}
    />,
  );
  const region = screen.getByRole("region", {
    name: /occurrences on the map/i,
  });
  expect(
    within(region).getByText(/in the current map view/i),
  ).toBeInTheDocument();
  expect(within(region).getByText("2")).toBeInTheDocument();
  expect(within(region).getAllByRole("button")).toHaveLength(2);
});

test("hovering a row reports its id for the map cross-highlight", async () => {
  const user = userEvent.setup();
  const onHover = vi.fn();
  render(
    <OccurrenceList
      occurrences={[occ("a", "Tyrannosaurus rex")]}
      totalAtAge={1}
      viewportActive={true}
      selectedId={null}
      highlightedId={null}
      onSelect={noop}
      onHover={onHover}
    />,
  );
  const row = screen.getByRole("button", { name: /Tyrannosaurus rex/ });
  await user.hover(row);
  expect(onHover).toHaveBeenCalledWith("a");
  await user.unhover(row);
  expect(onHover).toHaveBeenLastCalledWith(null);
});

test("the selected row is aria-current and the highlighted row carries the highlight state", () => {
  render(
    <OccurrenceList
      occurrences={[occ("a", "Tyrannosaurus rex"), occ("b", "Triceratops")]}
      totalAtAge={2}
      viewportActive={true}
      selectedId="a"
      highlightedId="b"
      onSelect={noop}
      onHover={noop}
    />,
  );
  expect(
    screen.getByRole("button", { name: /Tyrannosaurus rex/ }),
  ).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: /Triceratops/ })).toHaveAttribute(
    "data-highlighted",
    "true",
  );
});

test("with no map signal it lists the full age set (fallback header)", () => {
  render(
    <OccurrenceList
      occurrences={[occ("a", "Tyrannosaurus rex")]}
      totalAtAge={1}
      viewportActive={false}
      selectedId={null}
      highlightedId={null}
      onSelect={noop}
      onHover={noop}
    />,
  );
  expect(screen.getByText(/occurrence\(s\) at this age/i)).toBeInTheDocument();
});

test("an empty view over a non-empty age shows a recoverable message", () => {
  render(
    <OccurrenceList
      occurrences={[]}
      totalAtAge={7}
      viewportActive={true}
      selectedId={null}
      highlightedId={null}
      onSelect={noop}
      onHover={noop}
    />,
  );
  expect(screen.getByText(/No occurrences in this view/i)).toBeInTheDocument();
  expect(screen.getByText(/Zoom out or pan/i)).toBeInTheDocument();
});

test("the rendered rows are bounded by the cap with an overflow affordance", () => {
  const many = Array.from({ length: LIST_RENDER_CAP + 2 }, (_v, i) =>
    occ(`o${i}`, `Taxon ${i}`),
  );
  render(
    <OccurrenceList
      occurrences={many}
      totalAtAge={many.length}
      viewportActive={true}
      selectedId={null}
      highlightedId={null}
      onSelect={noop}
      onHover={noop}
    />,
  );
  const region = screen.getByRole("region", {
    name: /occurrences on the map/i,
  });
  expect(within(region).getAllByRole("button")).toHaveLength(LIST_RENDER_CAP);
  expect(
    within(region).getByText(
      new RegExp(`first ${LIST_RENDER_CAP} of ${many.length}`, "i"),
    ),
  ).toBeInTheDocument();
});

test("activating a row opens the occurrence panel (restored accessible loop)", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  // Map is unavailable in jsdom, so the list holds the full age set.
  const region = await screen.findByRole("region", {
    name: /occurrences on the map/i,
  });
  const firstRow = within(region).getAllByRole("button")[0]!;
  await user.click(firstRow);

  // The occurrence panel appears with its single primary action (SPEC-003 REQ-006).
  expect(
    screen.getByRole("button", { name: /Open taxon profile/i }),
  ).toBeInTheDocument();
});
