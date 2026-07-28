// @vitest-environment jsdom
/**
 * SPEC-008 REQ-005 / NFR-001 — stage-partitioned loading. The app boots the index
 * and shared reference, then fetches ONLY the active stage's occurrence file, and
 * exactly one more per timeline step — never a full-dataset artifact.
 */
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App.js";
import {
  bootAtlas,
  fetchStageOccurrences,
  referenceModel,
} from "../../src/app/data/atlas.js";
import type { AtlasIndex, StageSource } from "../../src/app/data/atlas.js";
import type { ModelLoader } from "../../src/app/data/snapshot.js";
import { mesozoicPartition } from "./app-harness.js";
import type { AtlasPartition } from "../../src/pipeline/partition.js";

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function atlasFetchMock(partition: AtlasPartition): {
  fetchImpl: typeof fetch;
  calls: string[];
} {
  const calls: string[] = [];
  const bySlug = new Map(partition.stages.map((s) => [s.slug, s]));
  const noHeader = (): string | null => null;
  const ok = (data: unknown): unknown => ({
    ok: true,
    headers: { get: noHeader },
    body: null,
    json: async () => data,
  });
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.endsWith("data/index.json")) return ok(partition.index);
    if (url.endsWith("data/reference.json")) return ok(partition.reference);
    if (url.endsWith("data/enrichment.json")) return ok(partition.enrichment);
    const m = url.match(/stage-([a-z0-9-]+)\.json$/);
    if (m) return ok({ occurrences: bySlug.get(m[1]!)?.occurrences ?? [] });
    return { ok: false, headers: { get: noHeader }, json: async () => ({}) };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test("boot fetches only the index and reference", async () => {
  const partition = await mesozoicPartition();
  const { fetchImpl, calls } = atlasFetchMock(partition);
  vi.stubGlobal("fetch", fetchImpl);

  const boot = await bootAtlas();
  expect(boot.index.stages.length).toBe(30);
  // 4 occurrence-bearing genera + their Family/clade ancestors (SPEC-010 DATA-003).
  expect(boot.reference.taxa.length).toBe(12);
  expect(calls.filter((u) => u.includes("data/"))).toEqual([
    "data/index.json",
    "data/reference.json",
    "data/enrichment.json",
  ]);

  const entry = boot.index.stages.find((s) => s.name === "Maastrichtian")!;
  const occurrences = await fetchStageOccurrences(entry);
  expect(occurrences.map((o) => o.id)).toContain("occ:cre1");
});

test("returns [] for a stage with no data file (empty state), no fetch", async () => {
  const partition = await mesozoicPartition();
  const { fetchImpl, calls } = atlasFetchMock(partition);
  vi.stubGlobal("fetch", fetchImpl);
  const induan = partition.index.stages.find((s) => s.name === "Induan")!;
  const before = calls.length;
  expect(await fetchStageOccurrences(induan)).toEqual([]);
  expect(calls.length).toBe(before); // dataUrl is null → nothing fetched
});

test("the app fetches only the active stage, then one more per step", async () => {
  const user = userEvent.setup();
  const partition = await mesozoicPartition();
  const { fetchImpl, calls } = atlasFetchMock(partition);
  vi.stubGlobal("fetch", fetchImpl);

  let index: AtlasIndex | null = null;
  const loader: ModelLoader = async (onProgress) => {
    const boot = await bootAtlas(onProgress);
    index = boot.index;
    return referenceModel(boot.reference);
  };
  const stageSource: StageSource = {
    get index(): AtlasIndex {
      return index!;
    },
    loadStageOccurrences: (stage, signal) => {
      const entry = index?.stages.find((s) => s.name === stage.name);
      return entry ? fetchStageOccurrences(entry, signal) : Promise.resolve([]);
    },
  };

  render(<App loader={loader} stageSource={stageSource} />);

  const timeline = await screen.findByRole("navigation", { name: /timeline/i });
  const stageFetches = (): string[] => calls.filter((u) => /stage-/.test(u));

  // Default stage Maastrichtian: exactly one stage file fetched, and its two
  // occurrences (T. rex + the boundary-straddling Triceratops) become visible.
  await waitFor(() =>
    expect(stageFetches()).toEqual(["data/stage-maastrichtian.json"]),
  );
  const count = (): number =>
    Number(
      screen.getByText((_c, el) => el?.getAttribute("aria-live") === "polite")
        .textContent,
    );
  await waitFor(() => expect(count()).toBe(2));

  // Step to the Norian → exactly one additional fetch, only that stage.
  await user.click(within(timeline).getByRole("button", { name: /Norian/ }));
  await waitFor(() =>
    expect(stageFetches()).toContain("data/stage-norian.json"),
  );
  expect(stageFetches().length).toBe(2);
  await waitFor(() => expect(count()).toBe(1)); // Plateosaurus only

  // Never fetched a whole-dataset snapshot.
  expect(calls.some((u) => u.includes("snapshot.json"))).toBe(false);
});
