// @vitest-environment jsdom
/**
 * SPEC-011 REQ-002/004/005 — exploration polish labels: the taxon-profile header
 * carries no stray "Main content" scaffolding label and discloses its time range
 * as the taxon's full recorded span; the empty state's reset control is labelled
 * for what it does (there are no user-set filters to reset).
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaxonProfile } from "../../src/app/components/TaxonProfile.js";
import { EmptyState } from "../../src/app/components/states.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("profile header drops the stray label and names the full recorded span (REQ-002/005)", async () => {
  const api = await fixtureApi();
  render(
    <TaxonProfile
      api={api}
      taxonId="txn:tyrannosaurus"
      onBack={() => {}}
      onOpenTaxon={() => {}}
    />,
  );

  // The leftover "Main content" scaffolding label is gone (REQ-002).
  expect(screen.queryByText("Main content")).not.toBeInTheDocument();

  // The header time range is labelled as the taxon's full recorded span so it
  // is not read as a contradiction with the per-age occurrence rows (REQ-005).
  expect(screen.getByText(/Recorded span/i)).toBeInTheDocument();
  expect(screen.queryByText(/^Time range$/)).not.toBeInTheDocument();
});

test("empty state resets the view without implying non-existent filters (REQ-004)", () => {
  render(<EmptyState onReset={() => {}} />);
  expect(
    screen.getByRole("button", { name: /Reset view/i }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/filters/i)).not.toBeInTheDocument();
});
