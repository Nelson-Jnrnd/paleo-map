// @vitest-environment jsdom
/**
 * SPEC-003 REQ-006 — the occurrence panel shows taxon, time range, modern
 * location, paleogeographic position and source, labels missing values
 * explicitly, and offers the single "Open taxon profile" primary action
 * (FONC-289/290/890…930, PERF-180). SPEC-007 removed the reconstructed cue and the
 * occurrence list, so the panel is rendered directly with a fixture occurrence.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { OccurrencePanel } from "../../src/app/components/OccurrencePanel.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("occurrence panel shows provenance fields and the primary action", async () => {
  const api = await fixtureApi();
  // The Lance occurrence (Triceratops) has no paleocoordinate.
  const occ = api
    .listOccurrences()
    .find((o) => o.paleoPosition.value === null)!;
  render(
    <OccurrencePanel
      api={api}
      occurrence={occ}
      onOpenProfile={() => {}}
      onClose={() => {}}
      backLabel="Back to 5 occurrence(s) in view"
    />,
  );

  const panel = screen.getByRole("region", { name: /Occurrence:/i });
  expect(within(panel).getByText("Time range")).toBeInTheDocument();
  expect(within(panel).getByText("Modern location")).toBeInTheDocument();
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
  const api = await fixtureApi();
  const occ = api
    .listOccurrences()
    .find((o) => o.paleoPosition.value !== null)!;
  render(
    <OccurrencePanel
      api={api}
      occurrence={occ}
      onOpenProfile={() => {}}
      onClose={() => {}}
      backLabel="Back to 5 occurrence(s) in view"
    />,
  );

  const panel = screen.getByRole("region", { name: /Occurrence:/i });
  // The paleocoordinate is shown (degree-marked values), and the retired
  // reconstructed cue is gone.
  expect(within(panel).getAllByText(/°/).length).toBeGreaterThan(0);
  expect(within(panel).queryByText("Reconstructed")).not.toBeInTheDocument();
});
