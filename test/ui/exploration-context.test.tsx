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

test("SPEC-031: the age is on the timeline and the header counts all map records", async () => {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const banner = screen.getByRole("banner");
  expect(within(banner).queryByText("Selected age")).toBeNull();
  expect(within(banner).queryByText("Group")).toBeNull();
  expect(
    screen.getByRole("navigation", { name: /timeline/i }),
  ).toHaveTextContent("Maastrichtian");
  expect(within(banner).getByText("All map occurrences")).toBeInTheDocument();
  expect(
    Number(banner.querySelector("[data-occurrence-count]")?.textContent),
  ).toBe(api.listOccurrences({ stage: "Maastrichtian" }).length);
  expect(
    within(banner).getByRole("button", { name: /Reset view/i }),
  ).toBeInTheDocument();
});
