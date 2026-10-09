// @vitest-environment jsdom
/**
 * SPEC-022 REQ-001…REQ-006 — the global app bar. One bar on every screen, three
 * destinations, the current one marked in shape as well as colour, no screen
 * carrying a return control of its own, and a reset that is quiet but still says
 * "Reset view" in words.
 *
 * This file also carries the "one action returns to the map" guarantee that used
 * to live in `spec017-screen.test.tsx` (OQ-040): the control moved into the bar,
 * so the coverage moved with it rather than being dropped.
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(() => {
  cleanup();
  // The bar drives the same fragment machinery the puzzle uses (NFR-001), and
  // jsdom keeps `location.hash` across tests — so a test that ends on Dinordle
  // would boot the next one straight back into the puzzle.
  globalThis.location.hash = "";
});

async function renderApp() {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  return userEvent.setup();
}

const nav = () => within(screen.getByRole("navigation", { name: /main/i }));

test("REQ-001/REQ-002: one bar, one banner, two primary destinations in order", async () => {
  await renderApp();
  // Exactly one banner and one main nav — the bar is rendered by the shell, so a
  // screen adding its own would show up here as a duplicate.
  expect(screen.getAllByRole("banner")).toHaveLength(1);
  expect(screen.getAllByRole("navigation", { name: /main/i })).toHaveLength(1);

  const labels = nav()
    .getAllByRole("button")
    .map((b) => b.textContent);
  expect(labels).toEqual(["Map", "Dinordle"]);
});

test("REQ-003: the current destination is marked, and never by colour alone", async () => {
  await renderApp();
  expect(nav().getByRole("button", { name: "Map" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The other two are not marked.
  for (const name of ["Dinordle"]) {
    expect(nav().getByRole("button", { name })).not.toHaveAttribute(
      "aria-current",
    );
  }
});

test("REQ-002/REQ-004: each destination is reachable, and returns in one action", async () => {
  const user = await renderApp();

  // Map → Dinordle. The puzzle screen carries no back control of its own.
  await user.click(nav().getByRole("button", { name: "Dinordle" }));
  expect(nav().getByRole("button", { name: "Dinordle" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    screen.queryByRole("button", { name: /back to map/i }),
  ).not.toBeInTheDocument();

  // One action back to the map (OQ-040), from the bar.
  await user.click(nav().getByRole("button", { name: "Map" }));
  expect(nav().getByRole("button", { name: "Map" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  expect(nav().queryByRole("button", { name: "Taxonomy" })).toBeNull();
  expect(screen.getByRole("navigation", { name: /timeline/i })).toBeTruthy();
});

test("UX-002: the bar renders identically on Dinordle's no-puzzle surface", async () => {
  const user = await renderApp();
  await user.click(nav().getByRole("button", { name: "Dinordle" }));
  // The UI fixture holds far fewer genera than MIN_POOL_SIZE, so this is the
  // honest data-error surface — exactly the state where being trapped would
  // matter most. All three destinations stay present and enabled.
  expect(screen.getByRole("alert").textContent).toContain("No puzzle today");
  for (const name of ["Map", "Dinordle"]) {
    expect(nav().getByRole("button", { name })).toBeEnabled();
  }
  expect(nav().getByRole("button", { name: "Dinordle" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // And the way out still works from here.
  await user.click(nav().getByRole("button", { name: "Map" }));
  expect(screen.getByRole("navigation", { name: /timeline/i })).toBeTruthy();
});

test("SPEC-031: the header keeps search and total count without repeating the timeline", async () => {
  await renderApp();
  expect(screen.getAllByText("Mesozoic Dinosaur Atlas")).toHaveLength(1);
  const banner = within(screen.getByRole("banner"));
  expect(banner.getByText("All map occurrences")).toBeInTheDocument();
  for (const label of ["Selected age", "Group"])
    expect(banner.queryByText(label)).toBeNull();
  expect(banner.getByRole("combobox")).toBeInTheDocument();
  expect(nav().queryByRole("button", { name: "Taxonomy" })).toBeNull();
});

test("REQ-006: the reset control is quiet, but still words and still a real target", async () => {
  await renderApp();
  const reset = screen.getByRole("button", { name: "Reset view" });
  // Words, not an icon — the accessible name is the visible text.
  expect(reset.textContent).toBe("Reset view");
  // Not a peer of the navigation: it sits outside the main nav.
  expect(nav().queryByRole("button", { name: "Reset view" })).toBeNull();
});
