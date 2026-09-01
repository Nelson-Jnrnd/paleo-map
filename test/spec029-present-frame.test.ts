/**
 * SPEC-029 REQ-001, DATA-001 — the committed present-day frame.
 *
 * The sharpest assertion here is that `selectFrame` can never return it. The
 * present frame is kept out of `frames` precisely so that a 0 Ma coastline
 * cannot be picked as the "nearest available" frame for a Mesozoic stage; this
 * test is what stops a future change from tidying it back into the list.
 */

import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { selectFrame } from "../src/app/data/basemap.js";
import type { BasemapFrameIndex } from "../src/app/data/basemap.js";
import { MESOZOIC_STAGES } from "../src/domain/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const basemapDir = join(repoRoot, "public", "basemap");
const index = JSON.parse(
  readFileSync(join(basemapDir, "index.json"), "utf-8"),
) as BasemapFrameIndex;

describe("REQ-001: the shipped present-day frame", () => {
  test("the index carries it as a sibling of `frames`, not a member", () => {
    expect(index.present).toBeDefined();
    expect(index.present?.targetAgeMa).toBe(0);
    expect(index.present?.geojsonUrl).toBe("basemap/present.geojson");
    // Nothing younger than the Mesozoic may be in the searchable list.
    const youngest = Math.min(...index.frames.map((f) => f.targetAgeMa));
    expect(youngest).toBeGreaterThan(60);
  });

  test("`selectFrame` cannot return it for any stage", () => {
    // The invariant the placement depends on, checked against every stage the
    // timeline can select rather than a sample.
    for (const stage of MESOZOIC_STAGES) {
      const picked = selectFrame(stage.name, index.frames);
      expect(picked?.frame.geojsonUrl, stage.name).not.toBe(
        "basemap/present.geojson",
      );
      expect(picked?.frame.targetAgeMa, stage.name).toBeGreaterThan(0);
    }
  });

  test("it is real coastline geometry, not an empty placeholder", () => {
    const geo = JSON.parse(
      readFileSync(join(basemapDir, "present.geojson"), "utf-8"),
    ) as { type: string; features: unknown[] };
    expect(geo.type).toBe("FeatureCollection");
    // A gate that passes on an empty file proves nothing.
    expect(geo.features.length).toBeGreaterThan(100);
  });

  test("it stays inside its payload budget", () => {
    const raw = readFileSync(join(basemapDir, "present.geojson"));
    expect(gzipSync(raw).length).toBeLessThanOrEqual(64 * 1024);
    expect(statSync(join(basemapDir, "present.geojson")).size).toBeGreaterThan(
      0,
    );
  });

  test("its meta names the source, model, licence and age", () => {
    const meta = JSON.parse(
      readFileSync(join(basemapDir, "present.meta.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(meta.targetAgeMa).toBe(0);
    expect(String(meta.source)).toMatch(/GPlates/i);
    expect(String(meta.model)).toMatch(/paleomap/i);
    expect(String(meta.licence)).toMatch(/CC BY/i);
    // REQ-005: the note has to say what the points over it are.
    expect(String(meta.note)).toMatch(/not reconstructions/i);
  });

  test("it is drawn from the same model as every stage frame", () => {
    // Same service, same model, same simplification — so the two frames a
    // reader toggles between differ only in age.
    const meta = JSON.parse(
      readFileSync(join(basemapDir, "present.meta.json"), "utf-8"),
    ) as { model: string; rotationModel: string };
    expect(meta.model).toBe(index.model);
    expect(meta.rotationModel).toBe(index.rotationModel);
  });
});

describe("DATA-001: an index without a present frame stays valid", () => {
  test("`present` is optional, and its absence is not an error", () => {
    const older: BasemapFrameIndex = {
      model: index.model,
      rotationModel: index.rotationModel,
      licence: index.licence,
      frames: index.frames,
    };
    expect(older.present).toBeUndefined();
    // And the stage path is completely unaffected by its absence.
    expect(selectFrame("Maastrichtian", older.frames)?.frame).toBeDefined();
  });
});
