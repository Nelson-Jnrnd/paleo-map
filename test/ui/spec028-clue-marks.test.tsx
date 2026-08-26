// @vitest-environment jsdom
/**
 * SPEC-028 REQ-004, REQ-005, UX-001/002/003 — the two clue channels as rendered.
 *
 * The verdicts themselves are covered browser-free in
 * `test/spec028-clue-channels.test.ts`; this file is only about where they land
 * and what they say. The load-bearing claim is REQ-004's: the marks sit on the
 * guess's own row in the tree, and **only** there — no second panel, no chips.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
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

/** The tree's rows, as the screen actually renders them. */
function treeRows(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[class*="diagram"] [class*="row"]',
    ),
  ];
}

/** The row whose taxon name is `name`. */
function rowFor(name: string): HTMLElement {
  const row = treeRows().find(
    (r) => r.querySelector('[class*="nodeName"]')?.textContent === name,
  );
  if (!row) throw new Error(`no tree row for ${name}`);
  return row;
}

test("REQ-004: a guess's row carries both marks", async () => {
  // Gorgosaurus (CA, US · 30) against Tyrannosaurus (CA, US · 40).
  renderGame("Tyrannosaurus");
  await guess("Gorgosaurus");

  const row = rowFor("Gorgosaurus");
  expect(row.textContent).toContain("also in CA · US");
  // 30 -> 40 is within a factor of two, and the answer has more.
  expect(row.textContent).toContain("▲");
  expect(row.textContent).not.toContain("▲▲");
});

test("REQ-004: a guess sharing no country says so in words", async () => {
  // Velociraptor (CN, MN · 3) against Tyrannosaurus (CA, US · 40).
  renderGame("Tyrannosaurus");
  await guess("Velociraptor");

  const row = rowFor("Velociraptor");
  expect(row.textContent).toContain("no shared country");
  // 3 -> 40 is well outside the band: the doubled arrow.
  expect(row.textContent).toContain("▲▲");
});

test("REQ-004: a guess with nothing recorded says so on both channels", async () => {
  // Nyasasaurus has neither countries nor occurrences in the fixture.
  renderGame("Tyrannosaurus");
  await guess("Nyasasaurus");

  const row = rowFor("Nyasasaurus");
  expect(row.textContent).toContain("countries not recorded");
  expect(row.textContent).toContain("occurrences not recorded");
  // "Not recorded" is never dressed up as a verdict.
  expect(row.textContent).not.toContain("no shared country");
});

test("REQ-004: an equal count reads as `=`, independently of the countries", async () => {
  // Diplodocus (PT, US · 40) against Tyrannosaurus (CA, US · 40).
  renderGame("Tyrannosaurus");
  await guess("Diplodocus");

  const row = rowFor("Diplodocus");
  expect(row.textContent).toContain("US");
  expect(row.textContent).not.toContain("PT");
  expect(row.textContent).toContain("=");
});

test("REQ-004: only guess rows carry marks — the trunk never does", async () => {
  renderGame("Tyrannosaurus");
  await guess("Diplodocus");

  // Dinosauria is an established ancestor, not a guess.
  const trunk = rowFor("Dinosauria");
  expect(trunk.textContent).not.toContain("=");
  expect(trunk.textContent).not.toContain("no shared country");
  expect(trunk.textContent).not.toMatch(/[▲▼]/);
});

test("REQ-004: no new bordered container, panel or chip is introduced", () => {
  renderGame("Tyrannosaurus");
  // The screen's subject is the tree; the checklist's first tell is a page of
  // boxes. If a future change reaches for one, this fails.
  for (const el of document.querySelectorAll<HTMLElement>('[class*="mark"]')) {
    expect(el.className).not.toMatch(/chip|badge|pill|card/i);
  }
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
  expect(body).toMatch(/recorded occurrences/i);
});

test("UX-001: each verdict is distinguishable without colour", async () => {
  // Glyph first, colour third: `=`, a single arrow, a doubled arrow are three
  // different strings before they are three different hues.
  renderGame("Tyrannosaurus");
  await guess("Diplodocus"); // same
  await guess("Gorgosaurus"); // close
  await guess("Velociraptor"); // far

  const mark = (name: string): string =>
    rowFor(name).textContent?.match(/=|▲▲|▼▼|▲|▼/)?.[0] ?? "";
  const marks = [mark("Diplodocus"), mark("Gorgosaurus"), mark("Velociraptor")];
  expect(marks).toEqual(["=", "▲", "▲▲"]);
  expect(new Set(marks).size).toBe(3);
});

test("UX-003: with no index loaded, the country channel is withheld and says why", async () => {
  renderGame("Tyrannosaurus", {}, { withGeography: false });
  await guess("Gorgosaurus");

  // Not silence, and not "not recorded" against every guess: the reason is on
  // the screen, and the occurrence channel keeps working.
  expect(
    screen.getByText(/Countries of occurrence are unavailable/i),
  ).toBeTruthy();
  const row = rowFor("Gorgosaurus");
  expect(row.textContent).not.toContain("also in CA · US");
  expect(row.textContent).not.toContain("countries not recorded");
  expect(row.textContent).toContain("▲");
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
