// @vitest-environment jsdom
/**
 * SPEC-005 REQ-001/003/004/005 — the aggregated, viewport-linked occurrence list:
 * grouped by taxon (default) with counts and keyboard disclosure, each group
 * expandable to provenance-legible occurrence rows, bounded per group, with a
 * group-by toggle and a group-level profile action.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import {
  GROUP_HEADER_CAP,
  GROUP_OCC_CAP,
  OccurrenceList,
} from "../../src/app/components/OccurrenceList.js";
import type { ReadOccurrence } from "../../src/domain/index.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("groups occurrences by taxon with counts and expandable rows", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const list = screen.getByRole("region", { name: /Visible occurrences/i });

  // Header states taxa + occurrence totals (FONC-060 framing).
  expect(within(list).getByText(/3\s*taxa/)).toBeInTheDocument();
  expect(within(list).getByText(/5\s*occurrences/)).toBeInTheDocument();

  // Collapsed: a disclosure per taxon, none of the occurrence rows shown yet.
  const tyrannoToggle = within(list).getByRole("button", {
    name: /Tyrannosaurus/,
  });
  expect(tyrannoToggle).toHaveAttribute("aria-expanded", "false");
  expect(within(list).queryByText(/^Source:/)).not.toBeInTheDocument();

  // Expand the taxon → its occurrence rows appear with source + uncertainty cues.
  await user.click(tyrannoToggle);
  expect(tyrannoToggle).toHaveAttribute("aria-expanded", "true");
  expect(within(list).getAllByText(/^Source:/).length).toBe(2); // two Tyrannosaurus occurrences
  // SPEC-007: the time cue is the factual "spans multiple stages"; the retired
  // reconstructed cue is gone.
  expect(within(list).getByText("Spans multiple stages")).toBeInTheDocument();
  expect(within(list).queryByText("Reconstructed")).not.toBeInTheDocument();
});

test("a missing paleoposition is labelled in an expanded group", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  await user.click(within(list).getByRole("button", { name: /Triceratops/ }));
  // The Lance occurrence has no paleocoordinate.
  expect(within(list).getByText("Not available")).toBeInTheDocument();
});

test("group-by toggle switches to formation grouping", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  await user.click(within(list).getByRole("button", { name: /By formation/i }));
  expect(
    within(list).getByRole("button", { name: /Hell Creek Formation/ }),
  ).toBeInTheDocument();
  expect(within(list).getByText(/formations/)).toBeInTheDocument();
});

test("a taxon group's profile action opens the taxon profile (REQ-003)", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  // The Nanotyrannus group has a single profile action.
  const nanoGroup = within(list)
    .getByRole("button", { name: /Nanotyrannus/ })
    .closest("li")!;
  await user.click(within(nanoGroup).getByRole("button", { name: /Profile/i }));
  expect(
    await screen.findByRole("region", { name: /Taxon profile: Nanotyrannus/i }),
  ).toBeInTheDocument();
});

test("bounds an expanded group to the per-group cap with an overflow hint (REQ-004)", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  const base = api.listOccurrences({ stage: "Maastrichtian" });
  // One taxon with many occurrences.
  const many: ReadOccurrence[] = Array.from({ length: 130 }, (_, i) => ({
    ...base[0]!,
    id: `occ:big:${i}`,
    taxonId: "txn:tyrannosaurus",
    taxonName: "Tyrannosaurus",
  }));

  render(
    <OccurrenceList
      api={api}
      occurrences={many}
      totalInFilter={many.length}
      viewportActive={false}
      groupBy="taxon"
      onGroupByChange={() => {}}
      selectedId={null}
      onSelect={() => {}}
      onOpenProfile={() => {}}
    />,
  );
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  // Collapsed header shows the true count …
  expect(within(list).getByText("130")).toBeInTheDocument();
  // … expanding renders at most the cap, plus an explicit overflow hint.
  await user.click(within(list).getByRole("button", { name: /Tyrannosaurus/ }));
  expect(within(list).getAllByText(/^Source:/).length).toBe(GROUP_OCC_CAP);
  expect(within(list).getByText(/Showing 50 of 130/)).toBeInTheDocument();
});

test("shows a recoverable empty-view message when the viewport has no occurrences (REQ-005)", () => {
  const api = { resolveSource: () => undefined } as never;
  render(
    <OccurrenceList
      api={api}
      occurrences={[]}
      totalInFilter={4187}
      viewportActive={true}
      groupBy="taxon"
      onGroupByChange={() => {}}
      selectedId={null}
      onSelect={() => {}}
      onOpenProfile={() => {}}
    />,
  );
  expect(
    screen.getByText(/No occurrences in the current map view/i),
  ).toBeInTheDocument();
  expect(screen.getByText(/4187 match the active filters/)).toBeInTheDocument();
});

test("bounds the number of group headers, showing the most abundant first (REQ-004)", async () => {
  const api = await fixtureApi();
  const base = api.listOccurrences({ stage: "Maastrichtian" });
  // Far more distinct taxa than the header cap.
  const many: ReadOccurrence[] = Array.from(
    { length: GROUP_HEADER_CAP + 40 },
    (_, i) => ({
      ...base[0]!,
      id: `occ:hdr:${i}`,
      taxonId: `txn:hdr:${i}`,
      taxonName: `Taxon${String(i).padStart(3, "0")}`,
    }),
  );

  render(
    <OccurrenceList
      api={api}
      occurrences={many}
      totalInFilter={many.length}
      viewportActive={false}
      groupBy="taxon"
      onGroupByChange={() => {}}
      selectedId={null}
      onSelect={() => {}}
      onOpenProfile={() => {}}
    />,
  );
  const list = screen.getByRole("region", { name: /Visible occurrences/i });
  // Header states the true taxa total …
  expect(
    within(list).getByText(/240 taxa · 240 occurrences/),
  ).toBeInTheDocument();
  // … but only the cap's worth of group toggles are rendered, plus the overflow hint.
  const toggles = within(list)
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-expanded") !== null);
  expect(toggles).toHaveLength(GROUP_HEADER_CAP);
  expect(
    within(list).getByText(/Showing the top 200 of 240 taxa/),
  ).toBeInTheDocument();
});
