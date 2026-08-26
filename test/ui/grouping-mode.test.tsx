// @vitest-environment jsdom
/**
 * SPEC-010 REQ-001 as amended by SPEC-026 REQ-001 (AMEND-003) — the unit
 * selector. What was a three-mode segmented control plus a rank `<select>` that
 * appeared only in Taxon mode is now one flat set of five options: two controls
 * answering one question became one. The default is still Occurrence, and
 * choosing still re-renders the list while the stage is preserved.
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { clusterCountLabel } from "../../src/app/components/OccurrenceMap.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

async function renderApp() {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  return within(
    await screen.findByRole("radiogroup", { name: /one row per/i }),
  );
}

test("defaults to Occurrence and offers the five units in one flat set", async () => {
  const group = await renderApp();
  expect(group.getAllByRole("radio").map((b) => b.textContent)).toEqual([
    "Occurrence",
    "Locality",
    "Genus",
    "Family",
    "Major group",
  ]);
  expect(group.getByRole("radio", { name: "Occurrence" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // SPEC-026 REQ-001: no second control appears, disappears or changes size as
  // a result of the choice — the rank `<select>` is gone for good.
  expect(screen.queryByRole("combobox", { name: /group by rank/i })).toBeNull();
  expect(
    screen.getByRole("region", { name: /occurrences on the map/i }),
  ).toBeInTheDocument();
  // SPEC-021 UX-004: the cluster legend paragraph is removed. SPEC-010 REQ-002's
  // disclosure did not go with it — it moved onto the clusters themselves as an
  // accessible name (SPEC-021 REQ-001, SPEC-010 AMEND-002), which is asserted
  // below and, end-to-end, in the Playwright suite. The map needs WebGL, so a
  // real cluster badge cannot render in jsdom.
  expect(
    screen.queryByText(/clusters count fossil records .* not distinct taxa/i),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/clusters count how many localities/i),
  ).not.toBeInTheDocument();
});

// SPEC-021 REQ-001/REQ-002: a cluster names the unit it counts, so its number can
// never be read as a count of distinct taxa. Locality mode counts localities;
// every other mode plots one feature per occurrence record.
test("a cluster badge names the unit it counts, per mode", () => {
  expect(clusterCountLabel(42, "occurrence")).toBe("42 occurrence records");
  expect(clusterCountLabel(12, "locality")).toBe("12 localities");
  expect(clusterCountLabel(1, "locality")).toBe("1 locality");
  expect(clusterCountLabel(1, "occurrence")).toBe("1 occurrence record");
  // Taxon mode does not collapse into locality groups, so it counts records too.
  expect(clusterCountLabel(7, "taxon")).toBe("7 occurrence records");
  // The unit is always named — never a bare number, which is the defect
  // SPEC-010 REQ-002 was written against.
  for (const mode of ["occurrence", "locality", "taxon"] as const) {
    expect(clusterCountLabel(3, mode)).toMatch(/\d+ \w/);
  }
});

test("switching to Locality re-renders the list under the new unit", async () => {
  const user = userEvent.setup();
  const group = await renderApp();
  await user.click(group.getByRole("radio", { name: "Locality" }));
  expect(group.getByRole("radio", { name: "Locality" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(group.getByRole("radio", { name: "Occurrence" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(
    screen.getByRole("region", { name: /localities on the map/i }),
  ).toBeInTheDocument();
});

test("REQ-001: a taxonomic tier is one action, not a mode plus a dropdown", async () => {
  const user = userEvent.setup();
  const group = await renderApp();

  // One click reaches Family — under the old control this was two, and the
  // second control only existed once the first had been used.
  await user.click(group.getByRole("radio", { name: "Family" }));
  expect(group.getByRole("radio", { name: "Family" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    screen.getByRole("region", { name: /family on the map/i }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: /group by rank/i })).toBeNull();

  // The option set is identical in every state.
  expect(group.getAllByRole("radio")).toHaveLength(5);

  await user.click(group.getByRole("radio", { name: "Occurrence" }));
  expect(group.getAllByRole("radio")).toHaveLength(5);
  expect(
    screen.getByRole("region", { name: /occurrences on the map/i }),
  ).toBeInTheDocument();
});
