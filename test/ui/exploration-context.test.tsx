// @vitest-environment jsdom
/**
 * SPEC-003 REQ-001/005 — the exploration shell's permanent context: selected age
 * (in Ma), selected group (dinosaurs by default), and the visible-occurrence
 * count, plus the not-a-complete-atlas framing (FONC-020/040/050/060/400,
 * CONS-450).
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("shows selected age in Ma, group, and a matching occurrence count", async () => {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  // Selected age is shown by stage name and Ma span (FONC-040/110), in the
  // permanent context bar (the banner landmark).
  const banner = screen.getByRole("banner");
  expect(within(banner).getByText("Selected age")).toBeInTheDocument();
  expect(within(banner).getByText(/Maastrichtian/)).toBeInTheDocument();
  expect(within(banner).getByText(/72\.1–66 Ma/)).toBeInTheDocument();

  // Group defaults to dinosaurs and is permanently displayed (FONC-020/050).
  expect(within(banner).getByText("Group")).toBeInTheDocument();
  expect(within(banner).getByText("Dinosaurs")).toBeInTheDocument();

  // Count matches the number of occurrences the API returns for the stage.
  const expected = api.listOccurrences({ stage: "Maastrichtian" }).length;
  const countEl = screen.getByText(
    (_c, el) => el?.getAttribute("aria-live") === "polite",
  );
  expect(Number(countEl.textContent)).toBe(expected);

  // SPEC-021 UX-001: the scope subtext under the title is removed on the owner's
  // instruction, and SPEC-003 REQ-005's disclaimer criterion retired with it
  // (SPEC-003 AMEND-005). FONC-400 is a prohibition, satisfied by omission.
  expect(
    screen.queryByText(/not a complete atlas of Mesozoic life/i),
  ).not.toBeInTheDocument();

  // The main controls (timeline, reset) stay visible (CONS-450).
  expect(
    screen.getByRole("navigation", { name: /timeline/i }),
  ).toBeInTheDocument();
  const header = screen.getByRole("banner");
  expect(
    within(header).getByRole("button", { name: /Reset view/i }),
  ).toBeInTheDocument();
  // The app exposes no user-set filters; the control must not imply otherwise
  // (SPEC-011 REQ-004).
  expect(
    within(header).queryByRole("button", { name: /Reset filters/i }),
  ).not.toBeInTheDocument();
});
