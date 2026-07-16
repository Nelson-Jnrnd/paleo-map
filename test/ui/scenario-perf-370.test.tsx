// @vitest-environment jsdom
/**
 * PERF-370 — activate a filter with no result → display an empty state → reset
 * filters — without a blocking error (SPEC-003 REQ-008). Selecting the Santonian
 * stage (no fixture occurrence overlaps it) yields the empty state; Reset returns
 * to the default age with occurrences visible again (FONC-080/1280).
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App.js";
import { fixtureLoader } from "./app-harness.js";

afterEach(cleanup);

test("PERF-370: empty result → empty state → reset filters", async () => {
  const user = userEvent.setup();
  render(<App loader={fixtureLoader()} />);

  const timeline = await screen.findByRole("navigation", { name: /timeline/i });

  // Select a stage with no overlapping occurrence.
  await user.click(within(timeline).getByRole("button", { name: /Santonian/ }));

  // Empty state appears, offering a recovery path.
  await screen.findByText(/No occurrences at this age/i);
  const emptyState = screen.getByRole("status");
  expect(
    within(emptyState).getByText(/No occurrences at this age/i),
  ).toBeInTheDocument();

  // Reset filters (from the empty state) restores the default age + results.
  await user.click(
    within(emptyState).getByRole("button", { name: /Reset filters/i }),
  );

  expect(
    screen.queryByText(/No occurrences at this age/i),
  ).not.toBeInTheDocument();
  expect(
    within(timeline).getByRole("button", { name: /Maastrichtian/ }),
  ).toHaveAttribute("aria-pressed", "true");
  // Occurrences are back (a Tyrannosaurus row is visible again).
  expect(
    screen.getAllByRole("button", { name: /Tyrannosaurus/ }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
