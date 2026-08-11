// @vitest-environment jsdom
/**
 * SPEC-019 UX-002, REQ-006, REQ-011, Error handling — every real state is
 * designed: the degraded pool, the blocked storage, the clipboard that refuses,
 * and the time clue's explicit "not available".
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadApi } from "../../src/read/api.js";
import { DailyGenusScreen } from "../../src/app/components/DailyGenusScreen.js";
import { fixtureModel } from "../spec019-fixture.js";
import { clockOn, memoryStore, renderGame } from "./spec019-harness.js";

afterEach(cleanup);

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

test("Error handling: a pool too small to be fair refuses to start, with a retry", () => {
  // The bare fixture holds six eligible genera — far below the floor.
  const onBack = vi.fn();
  render(
    <DailyGenusScreen
      api={ReadApi.fromModel(fixtureModel())}
      onBack={onBack}
      onOpenProfile={vi.fn()}
      now={clockOn("2026-08-11")}
      store={memoryStore()}
    />,
  );
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("No puzzle today");
  expect(alert.textContent).toContain("below the 500 needed");
  expect(alert.textContent).toContain("a data problem, not a wrong guess");
  expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
});

test("UX-002: with storage blocked the round plays on and says progress is not kept", () => {
  renderGame("Tyrannosaurus", { store: null });
  expect(
    screen.getByText(
      /Progress will not be kept — this browser blocks local storage/i,
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText("Guess a genus")).toBeTruthy();
});

test("UX-002: with a working store the warning is absent", () => {
  renderGame();
  expect(screen.queryByText(/Progress will not be kept/i)).toBeNull();
});

test("REQ-011: when the clipboard refuses, the result is shown as text", async () => {
  const original = globalThis.navigator.clipboard;
  try {
    renderGame();
    await guess("Tyrannosaurus");
    // Removed after the typing above, for the same reason as the test below:
    // user-event's setup() installs a clipboard stub of its own.
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    expect(
      screen.getByText(/Copy is unavailable — your result:/i),
    ).toBeTruthy();
    expect(screen.getByText(/Daily Genus \d+ · 1\/8/)).toBeTruthy();
  } finally {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: original,
      configurable: true,
    });
  }
});

test("REQ-011: a copied result reports success and names no taxon", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  renderGame();
  await guess("Tyrannosaurus");
  // Defined after the typing above: user-event's setup() installs a clipboard
  // stub of its own, which would otherwise replace this spy.
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
  expect(writeText).toHaveBeenCalledTimes(1);
  const shared = writeText.mock.calls[0]![0] as string;
  expect(shared).not.toContain("Tyrannosaurus");
  expect(shared).not.toContain("Dinosauria");
});

test("REQ-006: the answer's period is withheld until a guess overlaps it", async () => {
  renderGame();
  expect(
    screen.getByText(/The answer’s period appears once a guess overlaps it/i),
  ).toBeTruthy();

  // Nyasasaurus is Triassic; the answer is Cretaceous, so nothing is disclosed.
  await guess("Nyasasaurus");
  expect(screen.queryByText(/the answer’s period/i)?.textContent).not.toContain(
    "Cretaceous",
  );

  // Triceratops overlaps the answer's range, which discloses the period.
  await guess("Triceratops");
  expect(screen.getByText(/Cretaceous — the answer’s period/i)).toBeTruthy();
});

test("REQ-006: each guess's range is stated in words for assistive technology", async () => {
  renderGame();
  await guess("Diplodocus");
  expect(
    screen.getByText(/Guess 1, Diplodocus: the answer is younger\./i),
  ).toBeTruthy();
  await guess("Triceratops");
  expect(
    screen.getByText(/Guess 2, Triceratops: their ranges overlap\./i),
  ).toBeTruthy();
});

test("REQ-006: a guess with no recorded span reads not available, never blank", async () => {
  renderGame("Tyrannosaurus", {}, { noSpan: ["t:veloci"] });
  await guess("Velociraptor");
  expect(
    screen.getByText(/Velociraptor: no time span recorded — not available/i),
  ).toBeTruthy();
});

test("UX-002: the fresh, in-progress and finished states each read distinctly", async () => {
  renderGame();
  expect(screen.getByText("0 of 8 guesses")).toBeTruthy();
  await guess("Triceratops");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  await guess("Tyrannosaurus");
  expect(screen.getByText(/Solved in 2 of 8/i)).toBeTruthy();
  expect(screen.queryByText(/of 8 guesses$/)).toBeNull();
});
