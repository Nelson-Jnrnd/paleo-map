// @vitest-environment jsdom
/**
 * SPEC-009 REQ-003/004, UX-001 and SPEC-026 REQ-002 — the viewport-linked list.
 *
 * These behaviours were `OccurrenceList`'s until SPEC-026 folded the three
 * near-duplicate lists into one `UnitList`: an in-view count, hover reported for
 * the map cross-highlight, the selected row marked, a DOM bounded by the render
 * cap with an overflow affordance, and a recoverable empty-in-view state. They
 * are now shared chrome for all five units, so they are asserted here against the
 * one component that provides them.
 */
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LIST_RENDER_CAP,
  UnitList,
} from "../../src/app/components/UnitList.js";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

function noop(): void {}

/** An occurrence-unit row, in the shape `UnitList` renders for every unit. */
function row(id: string, taxon: string) {
  return {
    key: id,
    name: taxon,
    scientific: true,
    meta: ["66–72 Ma", "coll"],
    cladeTint: "#888888",
    accessibleName: `${taxon}, Theropod, 66–72 Ma, coll`,
  };
}

test("lists the in-view occurrences and states the in-view count", () => {
  render(
    <UnitList
      label="Occurrences on the map"
      noun="occurrence(s)"
      rows={[row("a", "Tyrannosaurus rex"), row("b", "Triceratops")]}
      totalAtAge={5}
      viewportActive={true}
      selectedKey={null}
      highlightedKey={null}
      onSelect={noop}
      onHighlight={noop}
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
    <UnitList
      label="Occurrences on the map"
      noun="occurrence(s)"
      rows={[row("a", "Tyrannosaurus rex")]}
      totalAtAge={1}
      viewportActive={true}
      selectedKey={null}
      highlightedKey={null}
      onSelect={noop}
      onHighlight={onHover}
    />,
  );
  const rowEl = screen.getByRole("button", { name: /Tyrannosaurus rex/ });
  await user.hover(rowEl);
  expect(onHover).toHaveBeenCalledWith("a");
  await user.unhover(rowEl);
  expect(onHover).toHaveBeenLastCalledWith(null);
});

test("the selected row is aria-current and the highlighted row carries the highlight state", () => {
  render(
    <UnitList
      label="Occurrences on the map"
      noun="occurrence(s)"
      rows={[row("a", "Tyrannosaurus rex"), row("b", "Triceratops")]}
      totalAtAge={2}
      viewportActive={true}
      selectedKey="a"
      highlightedKey="b"
      onSelect={noop}
      onHighlight={noop}
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
    <UnitList
      label="Occurrences on the map"
      noun="occurrence(s)"
      rows={[row("a", "Tyrannosaurus rex")]}
      totalAtAge={1}
      viewportActive={false}
      selectedKey={null}
      highlightedKey={null}
      onSelect={noop}
      onHighlight={noop}
    />,
  );
  expect(screen.getByText(/occurrence\(s\) at this age/i)).toBeInTheDocument();
});

test("an empty view over a non-empty age shows a recoverable message", () => {
  render(
    <UnitList
      label="Occurrences on the map"
      noun="occurrence(s)"
      rows={[]}
      totalAtAge={7}
      viewportActive={true}
      selectedKey={null}
      highlightedKey={null}
      onSelect={noop}
      onHighlight={noop}
    />,
  );
  // SPEC-026 REQ-002: the empty-in-view state is shared chrome for all five
  // units now, so its title is unit-neutral rather than naming occurrences.
  expect(screen.getByText(/Nothing in this view/i)).toBeInTheDocument();
  expect(screen.getByText(/Zoom out or pan/i)).toBeInTheDocument();
});

test("the rendered rows are bounded by the cap with an overflow affordance", () => {
  const many = Array.from({ length: LIST_RENDER_CAP + 2 }, (_v, i) =>
    row(`o${i}`, `Taxon ${i}`),
  );
  render(
    <UnitList
      label="Occurrences on the map"
      noun="occurrence(s)"
      rows={many}
      totalAtAge={many.length}
      viewportActive={true}
      selectedKey={null}
      highlightedKey={null}
      onSelect={noop}
      onHighlight={noop}
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
