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
    <TaxonProfile api={api} taxonId="txn:tyrannosaurus" onBack={() => {}} />,
  );

  // The header count is the whole-snapshot total (2), not the loaded 1.
  expect(screen.getByText(/Occurrences \(2\)/)).toBeInTheDocument();
  // The full time span (74–66.5 Ma) spans both occurrences, not just occ:1.
  expect(screen.getByText(/74–66\.5 Ma/)).toBeInTheDocument();
  // The listed subset is disclosed.
  expect(
    screen.getByText(/Showing 1 at the selected age/i),
  ).toBeInTheDocument();
});
