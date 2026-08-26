// @vitest-environment jsdom
/**
 * SPEC-019 NFR-001, DATA-001 — the puzzle reads only the snapshot already
 * loaded at boot. A full round completes with `fetch`, `XMLHttpRequest`,
 * `WebSocket` and `sendBeacon` all stubbed to throw, and the per-stage
 * occurrence files (~40 MB) are never touched.
 *
 * Extends the pattern of `test/data-005-no-runtime-egress.test.ts` to the
 * rendered screen.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderGame } from "./spec019-harness.js";

const originals = {
  fetch: globalThis.fetch,
  XMLHttpRequest: globalThis.XMLHttpRequest,
  WebSocket: globalThis.WebSocket,
};

function forbidNetwork(): { readonly attempts: string[] } {
  const attempts: string[] = [];
  const boom = (what: string) => {
    return (...args: unknown[]): never => {
      attempts.push(`${what}:${String(args[0])}`);
      throw new Error(`${what} is forbidden on the Dinordle screen`);
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
  vi.stubGlobal(
    "WebSocket",
    class {
      constructor(url: string) {
        boom("ws")(url);
      }
    },
  );
  if (globalThis.navigator) {
    Object.defineProperty(globalThis.navigator, "sendBeacon", {
      value: boom("beacon"),
      configurable: true,
    });
  }
  return { attempts };
}

beforeEach(() => forbidNetwork());
afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(globalThis, originals);
  cleanup();
});

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

test("NFR-001: a full round completes with every network API throwing", async () => {
  const { attempts } = forbidNetwork();
  renderGame();

  // Open, guess, lose the branch, win, share. (The hint step is gone with the
  // hint — SPEC-028 REQ-005 — but the round still has to reach six guesses for
  // the assertion below, and every guess now also derives two clue channels
  // from the boot-loaded country index, which is the new code path this test
  // has to prove makes no request of its own.)
  for (const name of [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
  ]) {
    await guess(name);
  }
  await guess("Tyrannosaurus");

  expect(screen.getByText(/Solved in 6 of 8/i)).toBeTruthy();
  expect(attempts).toEqual([]);
});

test("NFR-001: opening the screen fetches no per-stage occurrence file", () => {
  const { attempts } = forbidNetwork();
  renderGame();
  expect(screen.getByText("Dinosauria")).toBeTruthy();
  expect(attempts.filter((a) => a.includes("stage-"))).toEqual([]);
  expect(attempts).toEqual([]);
});

test("NFR-001: the practice round is equally offline", async () => {
  const { attempts } = forbidNetwork();
  renderGame("Tyrannosaurus", { mode: "practice" });
  await guess("Triceratops");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  expect(attempts).toEqual([]);
});
