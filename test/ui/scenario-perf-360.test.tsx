// @vitest-environment jsdom
/**
 * PERF-360 — change the selected age → observe the change in visible occurrences,
 * without a full application reload (SPEC-003 REQ-004, NFR-003). The app instance
 * is never remounted; stepping the stage re-filters in memory and the permanent
 * count updates (FONC-140/150, PERF-030).
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App.js";
import { fixtureLoader } from "./app-harness.js";

afterEach(cleanup);

function visibleCount(): number {
  // The permanent occurrence count lives in the aria-live context stat.
  const value = screen.getByText(
    (_content, el) => el?.getAttribute("aria-live") === "polite",
  );
  return Number(value.textContent);
}

test("PERF-360: changing the age updates visible occurrences in place", async () => {
  const user = userEvent.setup();
  render(<App loader={fixtureLoader()} />);

  const timeline = await screen.findByRole("navigation", { name: /timeline/i });
  const root = screen.getByRole("navigation", { name: /timeline/i }); // stable node identity check

  // Default age is Maastrichtian — all five fixture occurrences overlap it.
  expect(
    within(timeline).getByRole("button", { name: /Maastrichtian/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(visibleCount()).toBe(5);

  // Step to Campanian: only the 70–74 Ma occurrence overlaps.
  await user.click(within(timeline).getByRole("button", { name: /Campanian/ }));
  expect(visibleCount()).toBe(1);

  // Step back to Maastrichtian: the set updates again — no reload.
  await user.click(
    within(timeline).getByRole("button", { name: /Maastrichtian/ }),
  );
  expect(visibleCount()).toBe(5);

  // Same timeline node throughout: the view updated in place, not remounted.
  expect(screen.getByRole("navigation", { name: /timeline/i })).toBe(root);
});
