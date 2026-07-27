// @vitest-environment jsdom
/**
 * SPEC-008 AMEND-001 — a stage-partitioned taxon profile reports the taxon's
 * whole-snapshot occurrence total and time span, and discloses that the listed
 * occurrences are the subset at the selected age.
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaxonProfile } from "../../src/app/components/TaxonProfile.js";
import { fixtureModel } from "./app-harness.js";
import { ReadApi } from "../../src/read/api.js";

afterEach(cleanup);

test("shows the taxon's full total + span even when only one stage is loaded", async () => {
  const model = await fixtureModel();
  // Simulate the partitioned runtime: the reference profile carries the
  // whole-snapshot aggregate (T. rex → 2 occurrences), but only ONE of the two
  // is loaded for the active stage.
  const oneOccurrence = model.occurrences.filter((o) => o.id === "occ:1");
  const api = ReadApi.fromModel({ ...model, occurrences: oneOccurrence });

  render(
    <TaxonProfile api={api} taxonId="txn:tyrannosaurus" onBack={() => {}} onOpenTaxon={() => {}} />,
  );

  // The collapsed occurrences summary shows the whole-snapshot total (2), not 1.
  expect(screen.getByText(/Fossil occurrences \(2\)/)).toBeInTheDocument();
  // The full time span (74–66.5 Ma) spans both occurrences, not just occ:1.
  expect(screen.getAllByText(/74–66\.5 Ma/).length).toBeGreaterThan(0);
  // The listed subset is disclosed (rendered inside the collapsed details).
  expect(
    screen.getByText(/Showing 1 at the selected age/i),
  ).toBeInTheDocument();
  // SPEC-014 REQ-007: the occurrences list is collapsed by default.
  const details = screen
    .getByText(/Fossil occurrences \(2\)/)
    .closest("details");
  expect(details).not.toBeNull();
  expect((details as HTMLDetailsElement).open).toBe(false);
});
