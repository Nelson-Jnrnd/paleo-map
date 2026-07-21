/**
 * SPEC-006 UX-002 — download progress. `progressRatio` is pure and clamped;
 * `fetchReadModel` streams the body and emits determinate progress plus a
 * `preparing` phase, then returns the parsed model unchanged.
 */

import { afterEach, expect, test, vi } from "vitest";
import {
  fetchReadModel,
  progressRatio,
  type LoadProgress,
} from "../../src/app/data/snapshot.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("progressRatio clamps and reports indeterminate on unknown total", () => {
  expect(progressRatio(50, 100)).toBe(0.5);
  expect(progressRatio(0, 100)).toBe(0);
  expect(progressRatio(150, 100)).toBe(1); // gzip overshoot pins at 100%
  expect(progressRatio(10, undefined)).toBeUndefined();
  expect(progressRatio(10, 0)).toBeUndefined();
});

function streamResponse(
  model: unknown,
  opts: { contentLength?: string | null; chunks?: number } = {},
): Response {
  const bytes = new TextEncoder().encode(JSON.stringify(model));
  const n = opts.chunks ?? 3;
  const size = Math.ceil(bytes.length / n);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size)
    parts.push(bytes.slice(i, i + size));
  let idx = 0;
  const contentLength =
    opts.contentLength === undefined
      ? String(bytes.length)
      : opts.contentLength;
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "content-length" ? contentLength : null,
    },
    body: {
      getReader: () => ({
        read: async () =>
          idx < parts.length
            ? { done: false, value: parts[idx++] }
            : { done: true, value: undefined },
      }),
    },
    json: async () => model,
  } as unknown as Response;
}

const MODEL = {
  metadata: { generatedAt: "x" },
  sources: {},
  taxa: [],
  occurrences: [],
  profiles: [],
};

test("fetchReadModel streams determinate progress and returns the model", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => streamResponse(MODEL, { chunks: 4 })),
  );
  const events: LoadProgress[] = [];
  const model = await fetchReadModel("data/snapshot.json", (p) =>
    events.push(p),
  );

  expect(model).toEqual(MODEL);
  expect(events.some((e) => e.phase === "downloading")).toBe(true);
  expect(events.at(-1)?.phase).toBe("preparing");
  // Determinate: a ratio is reported and reaches 1 by the end of the download.
  const ratios = events
    .filter((e) => e.phase === "downloading")
    .map((e) => e.ratio ?? -1);
  expect(Math.max(...ratios)).toBe(1);
  expect(ratios.every((r) => r >= 0 && r <= 1)).toBe(true);
});

test("fetchReadModel is indeterminate when no content length is present", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => streamResponse(MODEL, { contentLength: null })),
  );
  const events: LoadProgress[] = [];
  await fetchReadModel("data/snapshot.json", (p) => events.push(p));
  const downloading = events.filter((e) => e.phase === "downloading");
  expect(downloading.length).toBeGreaterThan(0);
  expect(downloading.every((e) => e.ratio === undefined)).toBe(true);
  expect(downloading.at(-1)?.receivedBytes).toBeGreaterThan(0);
});

test("fetchReadModel throws a labelled error on a non-OK response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        ({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        }) as Response,
    ),
  );
  await expect(fetchReadModel("data/snapshot.json")).rejects.toThrow(/503/);
});
