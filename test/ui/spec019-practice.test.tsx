// @vitest-environment jsdom
/**
 * SPEC-019 REQ-010 — practice mode: the same game on demand, never today's
 * genus, and never touching the daily round or the record.
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildTaxonomyIndex } from "../../src/app/state/taxonomy.js";
import {
  buildGameData,
  selectDailyGenus,
} from "../../src/app/state/dailyGenus.js";
import { loadRound } from "../../src/app/state/dailyGenusStorage.js";
import { dateWithAnswer, harnessApi, renderGame } from "./spec019-harness.js";

afterEach(cleanup);

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

/**
 * Guess down a list, stopping if the round ends first. A practice answer is
 * drawn from the same pool as these names, so one of them may win the round.
 */
async function playOut(names: readonly string[]): Promise<void> {
  for (const name of names) {
    if (!screen.queryByLabelText("Guess a genus")) return;
    await guess(name);
  }
}

const EIGHT = [
  "Triceratops",
  "Diplodocus",
  "Velociraptor",
  "Gorgosaurus",
  "Nyasasaurus",
  "Fillerosaurus0",
  "Fillerosaurus1",
  "Fillerosaurus2",
];

test("REQ-010: practice is labelled as not today's puzzle, and unrecorded", async () => {
  renderGame();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /practice round/i }));
  expect(screen.getByText(/Practice — not today’s puzzle/i)).toBeTruthy();
  expect(screen.getByText(/Nothing here is recorded/i)).toBeTruthy();
  expect(screen.getByText(/Dinordle · practice/i)).toBeTruthy();
});

test("REQ-010: a practice round never draws today's genus", async () => {
  const api = harnessApi();
  const profiles = new Map(
    api.listTaxa().map((t) => [t.id, api.getProfile(t.id)]),
  );
  const data = buildGameData(
    api.listTaxa(),
    buildTaxonomyIndex(api.listTaxa()),
    (id) => profiles.get(id),
  );
  const dateKey = dateWithAnswer(api, "t:trex");
  expect(selectDailyGenus(dateKey, data.pool)).toBe("t:trex");

  // The exclusion itself is swept across the whole draw space at the pure level
  // (spec019-daily-selection); here the screen is checked to be wired to it —
  // a practice draw that would land on today's genus resolves to another.
  for (const draw of [0, 0.5, 0.999]) {
    cleanup();
    renderGame("Tyrannosaurus", { api, mode: "practice", random: () => draw });
    await playOut(EIGHT);
    // The reveal names the practice answer, and it is never today's.
    expect(screen.queryByText("Tyrannosaurus")).toBeNull();
  }
});

test("REQ-010: playing practice writes nothing to storage", async () => {
  const { store } = renderGame("Tyrannosaurus", { mode: "practice" });
  await guess("Triceratops");
  await guess("Diplodocus");
  expect(loadRound(store, "2026-08-11")).toBeNull();
  expect(store.map.size).toBe(0);
});

test("REQ-010: practice never reports a record", async () => {
  renderGame("Tyrannosaurus", { mode: "practice" });
  // Finish the practice round: no streak line, no copy action.
  await playOut(EIGHT);
  expect(screen.queryByText(/streak/i)).toBeNull();
  expect(screen.queryByRole("button", { name: /copy result/i })).toBeNull();
});

test("REQ-010: entering practice reports the mode change to the shell", async () => {
  const onModeChange = vi.fn();
  renderGame("Tyrannosaurus", { onModeChange });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /practice round/i }));
  expect(onModeChange).toHaveBeenCalledWith("practice");
});

test("REQ-010: a practice round is playable end to end", async () => {
  renderGame("Tyrannosaurus", { mode: "practice" });
  expect(screen.getByLabelText("Guess a genus")).toBeTruthy();
  await guess("Triceratops");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  expect(screen.getByText("Dinosauria")).toBeTruthy();
});
