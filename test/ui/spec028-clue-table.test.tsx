// @vitest-environment jsdom
/**
 * SPEC-028 REQ-004 (as amended 2026-08-26), REQ-005, UX-001/002/003 — the two
 * clue channels as rendered.
 *
 * The verdicts themselves are covered browser-free in
 * `test/spec028-clue-channels.test.ts`, and that file passes **unmodified**
 * across this amendment — which is the evidence that moving the channels off the
 * tree was a rendering change and not a logic one.
 *
 * The load-bearing claim here is the amended REQ-004's: the verdicts live in a
 * per-guess table beneath the board, and **no clue mark is rendered inside the
 * cladogram**, so the diagram's rows are exactly what SPEC-025 sized them for.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderGame } from "./spec019-harness.js";

afterEach(cleanup);

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

/** The clue table. */
function clues(): HTMLElement {
  return screen.getByRole("table", { name: /each guess against the answer/i });
}

/** One guess's row in the clue table, by the guess's name. */
function clueRow(name: string): HTMLElement {
  const row = within(clues())
    .getAllByRole("row")
    .find((r) => within(r).queryByRole("rowheader")?.textContent === name);
  if (!row) throw new Error(`no clue row for ${name}`);
  return row;
}

/** The cladogram region — what REQ-004 says must carry no clue mark. */
function diagram(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[class*="diagram"]');
  if (!el) throw new Error("no cladogram region rendered");
  return el;
}

test("REQ-004: the table carries one row per guess, in guess order", async () => {
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");
  await guess("Velociraptor");
  await guess("Diplodocus");

  const names = within(clues())
    .getAllByRole("rowheader")
    .map((h) => h.textContent);
  expect(names).toEqual(["Gorgosaurus", "Velociraptor", "Diplodocus"]);
});

test("REQ-004: no clue mark is rendered inside the cladogram", async () => {
  // The amendment's whole point. The tree carries the clade verdict and nothing
  // else; marks on its rows are what overflowed the diagram and clipped it.
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");
  await guess("Velociraptor");

  const tree = diagram().textContent ?? "";
  expect(tree).not.toMatch(/CA|US|MN/);
  expect(tree).not.toMatch(/[▲▼=]/);
  expect(tree).not.toMatch(/no shared country|not recorded/i);
  // And nothing with a clue class survives inside it.
  expect(diagram().querySelector('[class*="mark"]')).toBeNull();
});

test("REQ-004: the table is absent — not empty — before any guess", () => {
  renderGame("Tyrannosaurus");
  expect(
    screen.queryByRole("table", { name: /each guess against the answer/i }),
  ).toBeNull();
});

test("REQ-004: it does not restate the clade or the time verdict", async () => {
  renderGame("Tyrannosaurus");
  await guess("Velociraptor");

  const text = clues().textContent ?? "";
  // The tree owns the clade verdict; the Ma column owns time.
  expect(text).not.toMatch(/Coelurosauria|Maniraptora|Theropoda/);
  expect(text).not.toMatch(/older|younger|overlaps/i);
});

test("REQ-002: a guess's shared countries are listed", async () => {
  // Gorgosaurus (CA, US) against Tyrannosaurus (CA, US).
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");
  expect(clueRow("Gorgosaurus").textContent).toContain("CA · US");
});

test("REQ-002: no overlap and no data read differently", async () => {
  renderGame("Tyrannosaurus");
  await guess("Velociraptor"); // CN, MN — no overlap
  await guess("Nyasasaurus"); // nothing recorded

  expect(clueRow("Velociraptor").textContent).toContain("none shared");
  expect(clueRow("Nyasasaurus").textContent).toContain("not recorded");
  // The distinction REQ-002 exists for: an absence of data is never a verdict.
  expect(clueRow("Nyasasaurus").textContent).not.toContain("none shared");
});

test("REQ-003: the occurrence verdict is stated in words as well as a glyph", async () => {
  renderGame("Tyrannosaurus");
  await guess("Diplodocus"); // 40 vs 40
  await guess("Gorgosaurus"); // 30 vs 40 — within a factor of two
  await guess("Velociraptor"); // 3 vs 40 — far

  expect(clueRow("Diplodocus").textContent).toContain("same");
  expect(clueRow("Gorgosaurus").textContent).toContain("somewhat more");
  expect(clueRow("Velociraptor").textContent).toContain("far more");
});

test("UX-001: each verdict is distinguishable without colour", async () => {
  // Glyph first, colour third: three different strings before three hues, and
  // the words behind them differ too.
  renderGame("Tyrannosaurus");
  await guess("Diplodocus");
  await guess("Gorgosaurus");
  await guess("Velociraptor");

  const glyph = (name: string): string =>
    clueRow(name).textContent?.match(/=|▲▲|▼▼|▲|▼/)?.[0] ?? "";
  const glyphs = [
    glyph("Diplodocus"),
    glyph("Gorgosaurus"),
    glyph("Velociraptor"),
  ];
  expect(glyphs).toEqual(["=", "▲", "▲▲"]);
  expect(new Set(glyphs).size).toBe(3);
});

test("UX-002: the copy counts records, and never calls an animal common or rare", async () => {
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");
  await guess("Velociraptor");

  const body = document.body.textContent ?? "";
  // The same trap SPEC-020 UX-001 identified for popularity: an occurrence count
  // measures collection effort, not the animal.
  for (const forbidden of [
    /\bcommon\b/i,
    /\brare\b/i,
    /\babundant\b/i,
    /\bwidespread\b/i,
    /\bsuccessful\b/i,
  ]) {
    expect(body).not.toMatch(forbidden);
  }
  // The caption is where the table says what it is counting.
  expect(clues().textContent).toMatch(/records in this snapshot/i);
});

test("UX-003: with no index loaded, the countries column is withheld and says why", async () => {
  renderGame("Tyrannosaurus", {}, { withGeography: false });
  await guess("Gorgosaurus");

  // The column is gone rather than filled with "not recorded" for every guess…
  const headers = within(clues())
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
  expect(headers).toEqual(["Guess", "Occurrence records in this snapshot"]);
  // …the reason is on the screen…
  expect(
    screen.getByText(/Countries of occurrence are unavailable/i),
  ).toBeTruthy();
  // …and the other channel keeps working.
  expect(clueRow("Gorgosaurus").textContent).toContain("somewhat more");
});

test("REQ-004: no bordered container, panel or chip is introduced", async () => {
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");
  // A table of hairline rules, not a card. If a future change reaches for one,
  // this fails.
  expect(clues().className).not.toMatch(/chip|badge|pill|card|panel/i);
  for (const cell of within(clues()).getAllByRole("cell")) {
    expect(cell.className).not.toMatch(/chip|badge|pill|card/i);
  }
});

test("REQ-005: no silhouette-hint control exists in any state", async () => {
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");
  expect(screen.queryByText(/silhouette hint/i)).toBeNull();
  expect(
    screen.queryByRole("button", { name: /reveal the silhouette/i }),
  ).toBeNull();
});

test("UX-004: the announcement names both new verdicts", async () => {
  const { container } = renderGame("Tyrannosaurus");
  await guess("Velociraptor");

  const live = [...container.querySelectorAll('[aria-live="polite"]')]
    .map((n) => n.textContent ?? "")
    .join(" ");
  expect(live).toMatch(/no shared country/i);
  expect(live).toMatch(/far more recorded occurrences/i);
});

test("the scrolling region carries no height of its own — the canvas does", () => {
  // The structural half of SPEC-028 AMEND-001's defect. With the height on the
  // scrolling element, a horizontal scrollbar is laid out *inside* its content
  // box and clips the last row; with the height on an inner canvas, the
  // scrollbar sits below the canvas and the region simply grows by its
  // thickness.
  //
  // Asserted on the structure rather than on a rendered scrollbar because
  // headless Chromium draws overlay scrollbars, which take no layout space —
  // the very case that cannot reproduce the bug. This invariant is what makes
  // the bug impossible regardless of the platform's scrollbar style.
  renderGame("Tyrannosaurus");
  const region = diagram();
  const canvas = region.querySelector<HTMLElement>('[class*="canvas"]');

  expect(canvas).not.toBeNull();
  expect(region.style.height).toBe("");
  expect(canvas!.style.height).toMatch(/^\d+px$/);
  // The width belongs to the canvas too, or the region shrink-wraps it and the
  // page scrolls sideways instead of the region (UX-001 criterion 3).
  expect(region.style.width).toBe("");
  expect(canvas!.style.width).toMatch(/^\d+px$/);
});
