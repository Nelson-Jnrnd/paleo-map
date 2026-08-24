// @vitest-environment jsdom
/**
 * SPEC-010 REQ-001 — the grouping-mode control: three options (Occurrences /
 * Localities / Taxa), default Occurrences, switching re-renders the list under the
 * new unit while the stage is preserved; the rank selector shows only in Taxon mode.
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
    await screen.findByRole("group", { name: /group occurrences by/i }),
  );
}

test("defaults to Occurrences and offers the three modes", async () => {
  const group = await renderApp();
  expect(group.getByRole("button", { name: "Occurrences" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(group.getByRole("button", { name: "Localities" })).toBeInTheDocument();
  expect(group.getByRole("button", { name: "Taxa" })).toBeInTheDocument();
  // No rank selector outside Taxon mode.
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

test("switching to Localities re-renders the list under the new unit", async () => {
  const user = userEvent.setup();
  const group = await renderApp();
  await user.click(group.getByRole("button", { name: "Localities" }));
  expect(group.getByRole("button", { name: "Localities" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(group.getByRole("button", { name: "Occurrences" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    screen.getByRole("region", { name: /localities on the map/i }),
  ).toBeInTheDocument();
});

test("Taxon mode reveals the rank selector; other modes hide it", async () => {
  const user = userEvent.setup();
  const group = await renderApp();
  await user.click(group.getByRole("button", { name: "Taxa" }));
  expect(
    screen.getByRole("combobox", { name: /group by rank/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: /taxa on the map/i }),
  ).toBeInTheDocument();

  await user.click(group.getByRole("button", { name: "Occurrences" }));
  expect(screen.queryByRole("combobox", { name: /group by rank/i })).toBeNull();
});
