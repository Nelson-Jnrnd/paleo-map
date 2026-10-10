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
  await userEvent.click(
    screen.getByRole("button", { name: "Browse dinosaurs" }),
  );
  return within(
    await screen.findByRole("radiogroup", { name: /one row per/i }),
  );
}

test("SPEC-031: defaults to Genus and exposes only two public units", async () => {
  const group = await renderApp();
  expect(group.getAllByRole("radio").map((b) => b.textContent)).toEqual([
    "Genus",
    "Locality",
  ]);
  expect(group.getByRole("radio", { name: "Genus" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(screen.queryByRole("combobox", { name: /group by rank/i })).toBeNull();
  expect(
    screen.getByRole("region", { name: /genus on the map/i }),
  ).toBeInTheDocument();
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
  expect(group.getByRole("radio", { name: "Genus" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(
    screen.getByRole("region", { name: /localities on the map/i }),
  ).toBeInTheDocument();
});

test("SPEC-031: changing the public unit preserves the selected age", async () => {
  const user = userEvent.setup();
  const group = await renderApp();
  await user.click(group.getByRole("radio", { name: "Locality" }));
  await user.click(group.getByRole("radio", { name: "Genus" }));
  expect(group.getAllByRole("radio")).toHaveLength(2);
  expect(
    screen.getByRole("navigation", { name: /timeline/i }),
  ).toHaveTextContent("Maastrichtian");
});
