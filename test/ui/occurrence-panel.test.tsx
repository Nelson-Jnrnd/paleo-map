// @vitest-environment jsdom
/**
 * SPEC-003 REQ-006 — the occurrence panel shows taxon, time range, modern
 * location, reconstructed paleogeographic position and source, labels missing
 * values explicitly, and offers the single "Open taxon profile" primary action
 * (FONC-289/290/890…930/1130, PERF-180).
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("occurrence panel shows provenance fields and the primary action", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  // Expand the taxon group, then select the Lance occurrence (no paleocoordinate).
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  await user.click(within(list).getByRole("button", { name: /Triceratops/ }));
  await user.click(within(list).getByRole("button", { name: /Lance/ }));

  const panel = screen.getByRole("region", { name: /Occurrence:/i });
  expect(within(panel).getByText("Time range")).toBeInTheDocument();
  expect(within(panel).getByText("Modern location")).toBeInTheDocument();
  expect(within(panel).getByText(/Wyoming, USA/)).toBeInTheDocument();
  expect(
    within(panel).getByText("Paleogeographic position"),
  ).toBeInTheDocument();
  // Missing paleoposition is labeled, not blank (PERF-180).
  expect(within(panel).getByText("Not available")).toBeInTheDocument();
  expect(within(panel).getByText("Source")).toBeInTheDocument();

  // Exactly one primary action.
  expect(
    within(panel).getByRole("button", { name: /Open taxon profile/i }),
  ).toBeInTheDocument();
});

test("a paleoposition shows its coordinates without a reconstructed cue (SPEC-007)", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  // A Hell Creek occurrence has a paleocoordinate.
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  await user.click(within(list).getByRole("button", { name: /Tyrannosaurus/ }));
  await user.click(
    within(list).getAllByRole("button", { name: /Hell Creek/ })[0]!,
  );
  const panel = screen.getByRole("region", { name: /Occurrence:/i });
  // The paleocoordinate is shown (degree-marked values present), and the retired
  // reconstructed cue is gone.
  expect(within(panel).getAllByText(/°/).length).toBeGreaterThan(0);
  expect(within(panel).queryByText("Reconstructed")).not.toBeInTheDocument();
});
