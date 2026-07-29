// @vitest-environment jsdom
/**
 * SPEC-011 REQ-004 — exploration polish labels: the empty state's reset control
 * is labelled for what it does (there are no user-set filters to reset).
 *
 * NOTE: the REQ-002/005 taxon-profile header assertions were retired with
 * SPEC-014 AMEND-005 — the curated "spec sheet" header (and its "Recorded span"
 * label) no longer exists; the taxon page is now the inline Wikipedia article.
 * The profile is covered by data-states.test.tsx.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmptyState } from "../../src/app/components/states.js";

afterEach(cleanup);

test("empty state resets the view without implying non-existent filters (REQ-004)", () => {
  render(<EmptyState onReset={() => {}} />);
  expect(
    screen.getByRole("button", { name: /Reset view/i }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/filters/i)).not.toBeInTheDocument();
});
