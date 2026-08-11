// @vitest-environment jsdom
/**
 * SPEC-019 REQ-009, REQ-011, REQ-013 — the countdown, the UTC rollover that must
 * never swap the answer under the player, and the reload that resumes a round.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DailyGenusScreen } from "../../src/app/components/DailyGenusScreen.js";
import { loadRound } from "../../src/app/state/dailyGenusStorage.js";
import {
  dateWithAnswer,
  harnessApi,
  memoryStore,
  renderGame,
} from "./spec019-harness.js";

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

async function guess(name: string): Promise<void> {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

test("REQ-009: the countdown reads the true interval to the next 00:00 UTC", () => {
  const api = harnessApi();
  const dateKey = dateWithAnswer(api, "t:trex");
  render(
    <DailyGenusScreen
      api={api}
      onBack={vi.fn()}
      onOpenProfile={vi.fn()}
      now={() => new Date(`${dateKey}T17:47:16Z`)}
      store={memoryStore()}
    />,
  );
  expect(screen.getByText("06:12:44")).toBeTruthy();
  expect(screen.getByText(/next puzzle · 00:00 UTC/i)).toBeTruthy();
});

test("REQ-009: the countdown ticks down against the clock", () => {
  const api = harnessApi();
  const dateKey = dateWithAnswer(api, "t:trex");
  let instant = new Date(`${dateKey}T17:47:16Z`).getTime();
  render(
    <DailyGenusScreen
      api={api}
      onBack={vi.fn()}
      onOpenProfile={vi.fn()}
      now={() => new Date(instant)}
      store={memoryStore()}
    />,
  );
  expect(screen.getByText("06:12:44")).toBeTruthy();

  // Recomputed from the clock, not decremented — a long gap resolves correctly.
  instant += 3_600_000;
  act(() => void vi.advanceTimersByTime(1000));
  expect(screen.getByText("05:12:44")).toBeTruthy();
});

test("REQ-013: a UTC date change never swaps the answer under the player", async () => {
  const api = harnessApi();
  const dateKey = dateWithAnswer(api, "t:trex");
  let instant = new Date(`${dateKey}T23:59:30Z`).getTime();
  render(
    <DailyGenusScreen
      api={api}
      onBack={vi.fn()}
      onOpenProfile={vi.fn()}
      now={() => new Date(instant)}
      store={memoryStore()}
    />,
  );
  await guess("Velociraptor");
  expect(screen.getByText("Coelurosauria")).toBeTruthy();

  // Cross midnight UTC while the round is open.
  instant += 60_000;
  act(() => void vi.advanceTimersByTime(1000));

  // The round is untouched: same guess, same tree, same count.
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  expect(screen.getByText("Coelurosauria")).toBeTruthy();
  expect(screen.getByText("Maniraptora")).toBeTruthy();
  // And the new puzzle is offered rather than taken.
  expect(screen.getByText(/A new puzzle is available/i)).toBeTruthy();
});

test("REQ-013: the new day's round starts only on the explicit control", async () => {
  const api = harnessApi();
  const dateKey = dateWithAnswer(api, "t:trex");
  let instant = new Date(`${dateKey}T23:59:30Z`).getTime();
  render(
    <DailyGenusScreen
      api={api}
      onBack={vi.fn()}
      onOpenProfile={vi.fn()}
      now={() => new Date(instant)}
      store={memoryStore()}
    />,
  );
  await guess("Velociraptor");
  instant += 60_000;
  act(() => void vi.advanceTimersByTime(1000));

  await userEvent
    .setup({ advanceTimers: vi.advanceTimersByTime })
    .click(screen.getByRole("button", { name: /start today’s puzzle/i }));

  expect(screen.getByText("0 of 8 guesses")).toBeTruthy();
  expect(screen.queryByText("Coelurosauria")).toBeNull();
  expect(screen.queryByText(/A new puzzle is available/i)).toBeNull();
});

test("REQ-011: a reload resumes the same round in the same state", async () => {
  const store = memoryStore();
  const api = harnessApi();
  renderGame("Tyrannosaurus", { api, store });
  await guess("Velociraptor");
  await guess("Triceratops");

  const dateKey = dateWithAnswer(api, "t:trex");
  expect(
    loadRound(store, dateKey)?.guesses.map((g) => g.scientificName),
  ).toEqual(["Velociraptor", "Triceratops"]);

  // Re-mount with the same store: the round comes back, not a fresh one.
  cleanup();
  renderGame("Tyrannosaurus", { api, store });
  expect(screen.getByText("2 of 8 guesses")).toBeTruthy();
  expect(screen.getByText("Coelurosauria")).toBeTruthy();
  expect(screen.getByText("Maniraptora")).toBeTruthy();
  expect(screen.getByText("Ornithischia")).toBeTruthy();
});

test("REQ-011: a finished round resumes finished, and reports the record", async () => {
  const store = memoryStore();
  const api = harnessApi();
  renderGame("Tyrannosaurus", { api, store });
  await guess("Tyrannosaurus");
  expect(screen.getByText(/played 1 · solved 1 · streak 1/i)).toBeTruthy();

  cleanup();
  renderGame("Tyrannosaurus", { api, store });
  expect(screen.getByText(/Solved in 1 of 8/i)).toBeTruthy();
  expect(screen.queryByLabelText("Guess a genus")).toBeNull();
});

test("REQ-011: state stored for another UTC date does not resume", async () => {
  const store = memoryStore();
  const api = harnessApi();
  renderGame("Tyrannosaurus", { api, store });
  await guess("Velociraptor");

  cleanup();
  // Same store, a different day: a fresh round, not yesterday's.
  render(
    <DailyGenusScreen
      api={api}
      onBack={vi.fn()}
      onOpenProfile={vi.fn()}
      now={() => new Date("2027-01-01T12:00:00Z")}
      store={store}
    />,
  );
  expect(screen.getByText("0 of 8 guesses")).toBeTruthy();
  expect(screen.queryByText("Coelurosauria")).toBeNull();
});
