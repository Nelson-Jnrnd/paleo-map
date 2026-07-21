// @vitest-environment jsdom
/**
 * SPEC-008 REQ-004 — per-stage, time-varying basemap frames. `selectFrame`
 * resolves the selected stage to its exact frame, or the nearest available frame
 * (disclosed) when the stage has none, or null when there are no frames at all
 * (→ graticule). `loadBasemapFrameIndex` degrades to null on any failure.
 */
import { afterEach, expect, test, vi } from "vitest";
import {
  loadBasemapFrameIndex,
  selectFrame,
} from "../../src/app/data/basemap.js";
import type { FrameDescriptor } from "../../src/app/data/basemap.js";

afterEach(() => vi.restoreAllMocks());

const frame = (
  stage: string,
  slug: string,
  targetAgeMa: number,
): FrameDescriptor => ({
  stage,
  slug,
  targetAgeMa,
  geojsonUrl: `basemap/${slug}.geojson`,
  metaUrl: `basemap/${slug}.meta.json`,
});

const frames: FrameDescriptor[] = [
  frame("Norian", "norian", 217.8), // Triassic
  frame("Kimmeridgian", "kimmeridgian", 152), // Jurassic
  frame("Maastrichtian", "maastrichtian", 69), // Cretaceous
];

test("selects the exact frame for a stage that has one", () => {
  const picked = selectFrame("Maastrichtian", frames);
  expect(picked?.exact).toBe(true);
  expect(picked?.frame.slug).toBe("maastrichtian");
});

test("falls back to the nearest frame by target age when a stage has none", () => {
  // Campanian midpoint (~77.9 Ma) is nearest the Maastrichtian frame (69 Ma).
  const picked = selectFrame("Campanian", frames);
  expect(picked?.exact).toBe(false);
  expect(picked?.frame.slug).toBe("maastrichtian");

  // Carnian (~232 Ma) is nearest the Norian frame (217.8 Ma).
  expect(selectFrame("Carnian", frames)?.frame.slug).toBe("norian");
});

test("returns null when there are no frames at all (→ graticule)", () => {
  expect(selectFrame("Maastrichtian", [])).toBeNull();
});

test("loadBasemapFrameIndex parses the index on success", async () => {
  const index = {
    model: "paleomap",
    rotationModel: "scotese",
    licence: "x",
    frames,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => index,
    })) as unknown as typeof fetch,
  );
  const loaded = await loadBasemapFrameIndex();
  expect(loaded?.frames.length).toBe(3);
});

test("loadBasemapFrameIndex degrades to null on failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch,
  );
  expect(await loadBasemapFrameIndex()).toBeNull();
});
