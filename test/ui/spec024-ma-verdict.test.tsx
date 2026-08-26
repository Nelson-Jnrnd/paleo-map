// @vitest-environment jsdom
/**
 * SPEC-024 REQ-005…REQ-008 — the Ma column's per-guess verdict, and the retired
 * period reveal.
 *
 * The defect this replaces: every guess drew an identical teal bar, and the only
 * per-guess verdict lived in `visuallyHidden` text — so a sighted player was told
 * nothing at all. These tests assert the verdict is now carried on the bar, and
 * that it is never carried by colour alone.
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

/** The bars, in guess order. */
function bars(): HTMLElement[] {
  return [...document.querySelectorAll('[class*="barSlot"]')].map(
    (slot) => slot as HTMLElement,
  );
}

const classOf = (el: Element | null | undefined): string =>
  el?.getAttribute("class") ?? "";

test("REQ-005: an overlapping guess is solid, a missing guess is hollow", async () => {
  renderGame();
  await guess("Triceratops"); // overlaps the answer's span
  await guess("Diplodocus"); // answer is younger — a miss

  const slots = bars();
  expect(slots).toHaveLength(2);
  const [overlap, miss] = slots;
  expect(classOf(overlap!.querySelector('[class*="bar_"]'))).toMatch(
    /barOverlaps/,
  );
  expect(classOf(miss!.querySelector('[class*="bar_"]'))).toMatch(/barMisses/);
});

test("REQ-006: a miss points toward the answer; an overlap points nowhere", async () => {
  renderGame();
  await guess("Diplodocus"); // Jurassic: the answer is younger → ▼
  await guess("Nyasasaurus"); // Triassic: the answer is younger → ▼
  await guess("Triceratops"); // overlaps → no mark

  const slots = bars();
  const marks = slots.map(
    (s) => s.querySelector('[class*="barMark"]')?.textContent ?? null,
  );
  // The overlapping guess carries no direction mark.
  expect(marks[2]).toBeNull();
  // The misses carry one, and it is a real glyph, not an empty span.
  for (const m of marks.slice(0, 2)) expect(m === "▲" || m === "▼").toBe(true);
});

test("REQ-006: the mark sits at the end of the bar the answer lies beyond", async () => {
  // The column is oldest-at-top, so "toward the answer" is the top of the bar
  // when the answer is older and its foot when the answer is younger. Both used
  // to float above the bar: only the glyph changed, never the placement.
  renderGame("Tyrannosaurus"); // Late Cretaceous
  await guess("Diplodocus"); // Jurassic: the answer is younger → ▼
  const younger = bars()[0]!.querySelector('[class*="barMark"]')!;
  expect(younger.textContent).toBe("▼");
  expect(classOf(younger)).toMatch(/barMarkYounger/);
  expect(classOf(younger)).not.toMatch(/barMarkOlder/);
  cleanup();

  renderGame("Nyasasaurus"); // Middle Triassic
  await guess("Diplodocus"); // Jurassic: the answer is older → ▲
  const older = bars()[0]!.querySelector('[class*="barMark"]')!;
  expect(older.textContent).toBe("▲");
  expect(classOf(older)).toMatch(/barMarkOlder/);
  expect(classOf(older)).not.toMatch(/barMarkYounger/);

  // The two verdicts are placed by different classes, not by one shared rule.
  expect(classOf(younger)).not.toBe(classOf(older));
});

test("REQ-006 as amended: the key names three treatments, not four", async () => {
  renderGame();
  await guess("Triceratops");
  // AMEND-001 (owner, 2026-08-26) drops the fourth entry from the key.
  for (const word of [/overlaps/i, /answer older/i, /answer younger/i]) {
    expect(screen.getByText(word)).toBeTruthy();
  }
  expect(screen.queryByText(/no span recorded/i)).toBeNull();
});

test("REQ-007 survives that amendment: the ✕ mark and its sentence stay", async () => {
  // The boundary of AMEND-001, guarded: only the *key entry* went. A guess with
  // no recorded span must still be marked on the column and named beneath it, or
  // the mark would be undefined on the diagram — the failure SPEC-019 AMEND-005
  // identified for the retired `?`.
  renderGame("Tyrannosaurus", {}, { noSpan: ["t:veloci"] });
  await guess("Velociraptor");
  expect(
    screen.getByText(/Velociraptor has no time span recorded/i),
  ).toBeTruthy();
  expect(document.querySelector('[class*="barMissing"]')).toBeTruthy();
});

test("REQ-007: a guess with no recorded span is marked and named, never invisible", async () => {
  renderGame("Tyrannosaurus", {}, { noSpan: ["t:veloci"] });
  await guess("Velociraptor");

  const slot = bars()[0]!;
  // No bar: there is no extent to plot and none may be invented.
  expect(slot.querySelector('[class*="bar_"]')).toBeNull();
  // But the slot is still marked, outside the plotting area.
  expect(slot.querySelector('[class*="barMissing"]')).not.toBeNull();
  // And the screen says so in words, naming the guess.
  expect(
    screen.getByText(/Velociraptor has no time span recorded/i),
  ).toBeTruthy();
  // The existing assistive-technology sentence is retained verbatim in meaning.
  // It appears twice by design: once in the column's per-guess sentence and once
  // in the screen's live announcement of the latest guess.
  expect(
    screen.getAllByText(/no time span recorded — not available/i).length,
  ).toBeGreaterThan(0);
});

test("REQ-005/UX-002: the verdict survives with colour removed", async () => {
  renderGame();
  await guess("Triceratops");
  await guess("Diplodocus");

  const slots = bars();
  const overlapBar = slots[0]!.querySelector('[class*="bar_"]')!;
  const missBar = slots[1]!.querySelector('[class*="bar_"]')!;
  // Fill versus outline is a shape difference: the two bars carry different
  // classes, and the miss additionally carries a glyph. Neither distinction
  // depends on the colour value.
  expect(classOf(overlapBar)).not.toBe(classOf(missBar));
  expect(slots[1]!.querySelector('[class*="barMark"]')).not.toBeNull();
  expect(slots[0]!.querySelector('[class*="barMark"]')).toBeNull();
});

test("REQ-008: no band is lit, and the axis context stays", async () => {
  renderGame();
  await guess("Triceratops"); // previously the disclosure trigger

  // No band carries an emphasised weight any more.
  expect(document.querySelector('[class*="bandLit"]')).toBeNull();
  // The bands, ticks and period names remain — they are what make the column a
  // reading rather than eight floating bars.
  expect(document.querySelectorAll('[class*="band_"]').length).toBeGreaterThan(
    0,
  );
  expect(screen.getByText("Cretaceous")).toBeTruthy();
});
