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

test("SPEC-031: optional absent fields are omitted and references expand on demand", async () => {
  const api = await fixtureApi();
  const occ = api
    .listOccurrences()
    .find((o) => o.paleoPosition.value === null)!;
  render(
    <OccurrencePanel
      api={api}
      occurrence={occ}
      onOpenProfile={() => {}}
      onClose={() => {}}
      backLabel="Back to records"
    />,
  );
  const panel = screen.getByRole("region", { name: /Occurrence:/i });
  expect(within(panel).getByText("Found in")).toBeInTheDocument();
  expect(within(panel).queryByText("Paleogeographic position")).toBeNull();
  expect(within(panel).queryByText("Not available")).toBeNull();
  const details = within(panel)
    .getByText("Details and sources")
    .closest("details")!;
  expect(details).not.toHaveAttribute("open");
  expect(
    within(panel).getByRole("button", { name: /Read about this dinosaur/i }),
  ).toBeInTheDocument();
});

test("a paleoposition retains its coordinates in details without a reconstructed cue (SPEC-007)", async () => {
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
