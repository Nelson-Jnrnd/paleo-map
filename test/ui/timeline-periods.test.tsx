// @vitest-environment jsdom
/**
 * SPEC-008 REQ-003 — period grouping + quick-select. The timeline exposes the
 * three Mesozoic periods; selecting one jumps to a representative stage and
 * updates the map and the visible-occurrence count, while precise selection stays
 * stage-level.
 */
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelineControl } from "../../src/app/components/TimelineControl.js";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import {
  EXPLORATION_PERIODS,
  EXPLORATION_STAGES,
} from "../../src/app/state/exploration.js";
import { mesozoicApi } from "./app-harness.js";

afterEach(cleanup);

test("the period quick-select offers the three Mesozoic periods and reports the choice", async () => {
  const user = userEvent.setup();
  const onSelectPeriod = vi.fn();
  render(
    <TimelineControl
      stages={EXPLORATION_STAGES}
      periods={EXPLORATION_PERIODS}
      selected="Maastrichtian"
      onSelect={() => {}}
      onSelectPeriod={onSelectPeriod}
    />,
  );

  const group = screen.getByRole("group", { name: /jump to period/i });
  for (const period of ["Triassic", "Jurassic", "Cretaceous"]) {
    expect(
      within(group).getByRole("button", { name: period }),
    ).toBeInTheDocument();
  }
  await user.click(within(group).getByRole("button", { name: "Triassic" }));
  expect(onSelectPeriod).toHaveBeenCalledWith("Triassic");

  // SPEC-021 UX-002: the caption is removed on the owner's instruction and
  // SPEC-011 REQ-006 retired with it (SPEC-011 AMEND-002). The *behaviour* it
  // described is unchanged — the assertion above still proves the period jump —
  // so only the copy goes.
  expect(screen.queryByText(/most fossil-rich stage/i)).not.toBeInTheDocument();
});

test("selecting a period jumps to a representative stage and updates the count", async () => {
  const user = userEvent.setup();
  const api = await mesozoicApi();
  render(<ExplorationView api={api} />);

  // Default age Maastrichtian: Tyrannosaurus + the boundary-straddling Triceratops.
  expect(
    within(screen.getByRole("navigation", { name: /timeline/i })).getByRole(
      "button",
      { name: /Maastrichtian/ },
    ),
  ).toHaveAttribute("aria-pressed", "true");

  // Jump to the Triassic → representative stage Norian becomes the selected age.
  await user.click(
    within(screen.getByRole("group", { name: /jump to period/i })).getByRole(
      "button",
      { name: "Triassic" },
    ),
  );

  const norian = within(
    screen.getByRole("navigation", { name: /timeline/i }),
  ).getByRole("button", { name: /Norian/ });
  expect(norian).toHaveAttribute("aria-pressed", "true");

  // The count updates to the Triassic occurrence (Plateosaurus).
  const count = screen.getByText(
    (_c, el) => el?.getAttribute("aria-live") === "polite",
  );
  expect(Number(count.textContent)).toBe(1);
});
