// @vitest-environment jsdom
/**
 * SPEC-020 NFR-001 — the well-known track reads the same shipped snapshot as the
 * full one. The pageview data was fetched at build time and committed, so a
 * round on either track completes with every network API throwing.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadApi } from "../../src/read/api.js";
import { DailyGenusScreen } from "../../src/app/components/DailyGenusScreen.js";
import type { ReadModel, ReadProfile } from "../../src/domain/index.js";
import { clockOn, memoryStore, paddedModel } from "./spec019-harness.js";

const attempts: string[] = [];

function forbidNetwork(): void {
  const boom = (what: string) => {
    return (...args: unknown[]): never => {
      attempts.push(`${what}:${String(args[0])}`);
      throw new Error(`${what} is forbidden on the Daily Genus screen`);
    };
  };
  vi.stubGlobal("fetch", boom("fetch"));
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      open = boom("xhr");
      send = boom("xhr");
    },
  );
  if (globalThis.navigator) {
    Object.defineProperty(globalThis.navigator, "sendBeacon", {
      value: boom("beacon"),
      configurable: true,
    });
  }
}

beforeEach(() => {
  attempts.length = 0;
  forbidNetwork();
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function rankedApi(): ReadApi {
  const base = paddedModel();
  const model: ReadModel = {
    ...base,
    profiles: base.profiles.map((p, i): ReadProfile => ({
      ...p,
      popularity: 500_000 - i,
    })),
  };
  return ReadApi.fromModel(model);
}

function renderTrack(track: "full" | "wellKnown") {
  return render(
    <DailyGenusScreen
      api={rankedApi()}
      onBack={vi.fn()}
      onOpenProfile={vi.fn()}
      now={clockOn("2026-08-11")}
      random={() => 0}
      store={memoryStore()}
      track={track}
    />,
  );
}

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

test("NFR-001: the well-known track opens and plays with no network at all", async () => {
  renderTrack("wellKnown");
  expect(screen.getByText(/TAXONOMIC TREE/i)).toBeTruthy();
  await guess("Triceratops");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  expect(attempts).toEqual([]);
});

test("NFR-001: switching track issues no request either", async () => {
  renderTrack("full");
  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /well-known/i }));
  expect(
    (screen.getByRole("radio", { name: /well-known/i }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(attempts).toEqual([]);
});

test("NFR-001: the ranking is read from the snapshot, never fetched", () => {
  // The popularity figures live on the profiles the app already loaded; if the
  // screen tried to fetch them, the stub above would have recorded it.
  renderTrack("wellKnown");
  expect(attempts.filter((a) => a.includes("wikimedia"))).toEqual([]);
  expect(attempts).toEqual([]);
});
