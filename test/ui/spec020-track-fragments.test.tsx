// @vitest-environment jsdom
/**
 * SPEC-020 REQ-007, NFR-001 — four addresses, one per (track × mode), no router,
 * and the whole thing still offline.
 */

import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  DAILY_FRAGMENT,
  DAILY_KNOWN_FRAGMENT,
  PRACTICE_FRAGMENT,
  PRACTICE_KNOWN_FRAGMENT,
  fragmentFor,
  parseFragment,
} from "../../src/app/state/screenFragment.js";
import {
  explorationReducer,
  initialExplorationState,
} from "../../src/app/state/exploration.js";
import { ReadApi } from "../../src/read/api.js";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { paddedModel } from "./spec019-harness.js";
import type { ReadModel, ReadProfile } from "../../src/domain/index.js";

afterEach(cleanup);

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

test("REQ-007: each track × mode has its own address", () => {
  expect(parseFragment(DAILY_FRAGMENT)).toEqual({
    screen: "daily",
    mode: "daily",
    track: "full",
  });
  expect(parseFragment(PRACTICE_FRAGMENT)).toEqual({
    screen: "daily",
    mode: "practice",
    track: "full",
  });
  expect(parseFragment(DAILY_KNOWN_FRAGMENT)).toEqual({
    screen: "daily",
    mode: "daily",
    track: "wellKnown",
  });
  expect(parseFragment(PRACTICE_KNOWN_FRAGMENT)).toEqual({
    screen: "daily",
    mode: "practice",
    track: "wellKnown",
  });
});

test("REQ-007: formatting round-trips every combination", () => {
  for (const fragment of [
    DAILY_FRAGMENT,
    PRACTICE_FRAGMENT,
    DAILY_KNOWN_FRAGMENT,
    PRACTICE_KNOWN_FRAGMENT,
  ]) {
    const intent = parseFragment(fragment)!;
    expect(fragmentFor("daily", intent.mode, intent.track)).toBe(fragment);
  }
});

test("REQ-007: unknown fragments still address nothing", () => {
  for (const other of [
    "",
    "#",
    "#map",
    "#taxonomy",
    "#daily-genus",
    "#known",
    "#practice-full",
  ]) {
    expect(parseFragment(other)).toBeNull();
  }
});

test("REQ-008: the SPEC-019 fragments keep their meaning", () => {
  // `#daily` must not have quietly become the well-known track.
  expect(parseFragment(DAILY_FRAGMENT)?.track).toBe("full");
  expect(fragmentFor("daily", "daily")).toBe(DAILY_FRAGMENT);
  expect(fragmentFor("map", "daily", "wellKnown")).toBe("");
});

test("REQ-004: the reducer carries the track and keeps it across a mode change", () => {
  const opened = explorationReducer(initialExplorationState, {
    type: "openDaily",
    mode: "daily",
    track: "wellKnown",
  });
  expect(opened.dailyTrack).toBe("wellKnown");
  // Switching to practice without naming a track keeps the chosen one.
  const practice = explorationReducer(opened, {
    type: "openDaily",
    mode: "practice",
  });
  expect(practice.dailyTrack).toBe("wellKnown");
  expect(practice.dailyMode).toBe("practice");
});

test("REQ-007/NFR-001: booting at #daily-known opens that track with no network", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("the puzzle must not reach the network");
  });
  globalThis.location.hash = DAILY_KNOWN_FRAGMENT;
  try {
    render(<ExplorationView api={rankedApi()} />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("radio", { name: /well-known/i })
          .getAttribute("aria-checked"),
      ).toBe("true"),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    globalThis.location.hash = "";
  }
});

test("REQ-007: no routing library is added", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  for (const router of [
    "react-router",
    "react-router-dom",
    "wouter",
    "@tanstack/react-router",
  ]) {
    expect(all).not.toContain(router);
  }
});
