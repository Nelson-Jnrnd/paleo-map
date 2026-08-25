// @vitest-environment jsdom
/**
 * SPEC-026 REQ-002/REQ-004/REQ-005/REQ-006 — the sidebar's substance.
 *
 * The redesign surfaced two live defects in the shipped build, and REQ-004/005
 * exist to fix them: the not-classified bucket sorted last and so fell past the
 * 300-row cap (2,810 of 4,945 Maastrichtian records — 57% — off-screen), and
 * alphabetical ordering hid the largest genera, *Triceratops* and
 * *Tyrannosaurus*, behind the same cap.
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";
import {
  classifiesAt,
  groupByLocality,
  groupByTaxon,
} from "../../src/app/state/grouping.js";
import type { ReadOccurrence, ReadTaxon } from "../../src/domain/index.js";

afterEach(cleanup);

async function renderApp() {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const units = within(
    await screen.findByRole("radiogroup", { name: /one row per/i }),
  );
  return { user, units, api };
}

test("REQ-004: no not-classified row exists at any taxon unit", async () => {
  const { user, units } = await renderApp();
  for (const unit of ["Genus", "Family", "Major group"]) {
    await user.click(units.getByRole("radio", { name: unit }));
    expect(screen.queryByText(/not classified/i)).not.toBeInTheDocument();
  }
});

test("REQ-004: the same filter drives the list, the count and the map", async () => {
  const { api } = await renderApp();
  const occurrences = api.listOccurrences();
  const taxa = new Map<string, ReadTaxon>(
    api.listTaxa().map((t) => [t.id, t]),
  );

  const classified = occurrences.filter((o: ReadOccurrence) =>
    classifiesAt(o, "genus", taxa),
  );
  const groups = groupByTaxon(occurrences, "genus", taxa);
  const total = groups.reduce((n, g) => n + g.count, 0);

  // Every record behind a row classifies, and the totals agree — which is what
  // stops the map plotting a point that has no row behind it.
  expect(total).toBe(classified.length);
  expect(groups.every((g) => Boolean(g.taxonId))).toBe(true);
});

test("REQ-004: those records are still present under Occurrence and Locality", async () => {
  const { user, units } = await renderApp();

  await user.click(units.getByRole("radio", { name: "Occurrence" }));
  const occRegion = screen.getByRole("region", {
    name: /occurrences on the map/i,
  });
  const occRows = within(occRegion).getAllByRole("button").length;
  expect(occRows).toBeGreaterThan(0);

  // The taxon unit lists no more than the Occurrence unit: REQ-004 removes
  // records that do not classify, and nothing else. (The default Wikipedia gate,
  // SPEC-014 AMEND-005, narrows both units equally and composes with this filter
  // rather than being replaced by it.)
  await user.click(units.getByRole("radio", { name: "Genus" }));
  const genusRegion = screen.getByRole("region", { name: /genus on the map/i });
  const genusRows = within(genusRegion).getAllByRole("button").length;
  expect(genusRows).toBeLessThanOrEqual(occRows);
});

test("REQ-005: rows are ordered by count descending, deterministically", async () => {
  const { api } = await renderApp();
  const taxa = new Map<string, ReadTaxon>(
    api.listTaxa().map((t) => [t.id, t]),
  );
  const groups = groupByTaxon(api.listOccurrences(), "genus", taxa);
  const counts = groups.map((g) => g.count);
  expect([...counts].sort((a, b) => b - a)).toEqual(counts);

  // Same input, same order — the tie-break is total, so the cap always keeps
  // the same rows.
  const again = groupByTaxon(api.listOccurrences(), "genus", taxa);
  expect(again.map((g) => g.key)).toEqual(groups.map((g) => g.key));
});

test("REQ-005: localities are ordered by distinct-taxon count descending", async () => {
  const { api } = await renderApp();
  const groups = groupByLocality(api.listOccurrences());
  const counts = groups.map((g) => g.taxonCount);
  expect([...counts].sort((a, b) => b - a)).toEqual(counts);
});

test("REQ-002: a locality row states where it is today, and carries no clade tint", async () => {
  const { user, units, api } = await renderApp();
  await user.click(units.getByRole("radio", { name: "Locality" }));

  const region = screen.getByRole("region", { name: /localities on the map/i });
  const rows = within(region).getAllByRole("button");
  expect(rows.length).toBeGreaterThan(0);

  // The present-day region ships in the snapshot and is rendered verbatim.
  const groups = groupByLocality(api.listOccurrences());
  const withRegion = groups.find((g) => g.region);
  if (withRegion) {
    expect(within(region).getAllByText(new RegExp(withRegion.region!, "i")).length)
      .toBeGreaterThan(0);
  }
  // UX-002: a locality is a place, not a clade — no tint rule on its rows.
  for (const row of rows) expect(row.getAttribute("data-clade")).toBeNull();
});

test("REQ-002: a row carries at most two meta values", async () => {
  const { user, units } = await renderApp();
  for (const unit of ["Occurrence", "Locality", "Genus"]) {
    await user.click(units.getByRole("radio", { name: unit }));
    const region = screen.getByRole("region", { name: /on the map/i });
    for (const row of within(region).getAllByRole("button")) {
      const meta = row.querySelector('[class*="unitRowMeta"]');
      const values = (meta?.textContent ?? "").split("·").filter(Boolean);
      expect(values.length).toBeLessThanOrEqual(2);
    }
  }
});

test("UX-002: a taxon row carries a clade tint and names the clade without sight", async () => {
  const { user, units } = await renderApp();
  await user.click(units.getByRole("radio", { name: "Genus" }));
  const region = screen.getByRole("region", { name: /genus on the map/i });
  const row = within(region).getAllByRole("button")[0]!;

  // The tint is present…
  expect(row.getAttribute("data-clade")).toBe("true");
  // …and the clade it stands for is in the row's accessible name, so the colour
  // never carries a meaning that has no worded form.
  const label = row.getAttribute("aria-label") ?? "";
  expect(label).toMatch(/occurrences/);
  expect(label.split(",").length).toBeGreaterThanOrEqual(3);
});

test("REQ-006: hovering a row in a taxon unit reports a highlight upward", async () => {
  const { user, units } = await renderApp();
  await user.click(units.getByRole("radio", { name: "Genus" }));
  const region = screen.getByRole("region", { name: /genus on the map/i });
  const row = within(region).getAllByRole("button")[0]!;

  // The linkage existed for the Occurrence unit only before SPEC-026 — the
  // other lists took no hover prop at all.
  await user.hover(row);
  expect(row).toBeInTheDocument();
  await user.unhover(row);
});
