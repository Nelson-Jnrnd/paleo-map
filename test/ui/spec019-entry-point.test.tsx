// @vitest-environment jsdom
/**
 * SPEC-019 REQ-012, NFR-001 — addressability without a router: `#daily` and
 * `#practice` open the puzzle, the fragment stays in step with the screen, and
 * the whole thing runs with `fetch` stubbed to throw.
 */

import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DAILY_FRAGMENT,
  PRACTICE_FRAGMENT,
  fragmentFor,
  parseFragment,
} from "../../src/app/state/screenFragment.js";
import {
  explorationReducer,
  initialExplorationState,
} from "../../src/app/state/exploration.js";

afterEach(cleanup);

test("REQ-012: the fragments address the puzzle, and nothing else does", () => {
  // SPEC-020 REQ-007 added a track to the intent; the SPEC-019 fragments keep
  // their meaning and resolve to the full track.
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
  expect(parseFragment("#DAILY")).toEqual({
    screen: "daily",
    mode: "daily",
    track: "full",
  });
  for (const other of ["", "#", "#map", "#taxonomy", "#daily-genus"]) {
    expect(parseFragment(other)).toBeNull();
  }
});

test("REQ-012: only the puzzle carries a fragment; other screens clear it", () => {
  expect(fragmentFor("daily", "daily")).toBe(DAILY_FRAGMENT);
  expect(fragmentFor("daily", "practice")).toBe(PRACTICE_FRAGMENT);
  expect(fragmentFor("map", "daily")).toBe("");
  expect(fragmentFor("taxonomy", "daily")).toBe("");
  expect(fragmentFor("profile", "practice")).toBe("");
});

test("REQ-012: the reducer opens the puzzle and returns to the map in one action", () => {
  const opened = explorationReducer(initialExplorationState, {
    type: "openDaily",
    mode: "practice",
  });
  expect(opened.screen).toBe("daily");
  expect(opened.dailyMode).toBe("practice");
  // Age and filters survive the navigation, like every other screen.
  expect(opened.stageName).toBe(initialExplorationState.stageName);
  expect(opened.mode).toBe(initialExplorationState.mode);

  const back = explorationReducer(opened, { type: "backToMap" });
  expect(back.screen).toBe("map");
  expect(back.stageName).toBe(initialExplorationState.stageName);
});

test("REQ-012: no routing library is added to the project", () => {
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

test("REQ-012/NFR-001: the shell opens the puzzle from #daily with no network", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("the puzzle must not reach the network");
  });
  globalThis.location.hash = DAILY_FRAGMENT;
  try {
    const { ExplorationView } =
      await import("../../src/app/components/ExplorationView.js");
    const { render } = await import("@testing-library/react");
    const { harnessApi } = await import("./spec019-harness.js");
    render(<ExplorationView api={harnessApi()} />);

    await waitFor(() =>
      expect(screen.getByText(/Dinordle · No\./i)).toBeTruthy(),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    globalThis.location.hash = "";
  }
});

test("REQ-012: leaving the puzzle clears the fragment", async () => {
  globalThis.location.hash = DAILY_FRAGMENT;
  const { ExplorationView } =
    await import("../../src/app/components/ExplorationView.js");
  const { render } = await import("@testing-library/react");
  const { harnessApi } = await import("./spec019-harness.js");
  render(<ExplorationView api={harnessApi()} />);

  // SPEC-022 REQ-004/NFR-001: leaving the puzzle now happens through the app
  // bar's Map destination. The fragment contract is unchanged — leaving must
  // clear the fragment exactly once and must not re-open the puzzle.
  await waitFor(() =>
    expect(screen.getByRole("navigation", { name: /main/i })).toBeTruthy(),
  );
  const mainNav = screen.getByRole("navigation", { name: /main/i });
  await userEvent
    .setup()
    .click(within(mainNav).getByRole("button", { name: "Map" }));
  await waitFor(() => expect(globalThis.location.hash).toBe(""));
});
