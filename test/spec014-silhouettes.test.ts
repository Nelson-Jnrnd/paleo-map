/**
 * SPEC-014 REQ-004 — the silhouette index is the committed contract: applying it
 * attaches a bundled PhyloPic silhouette path to each profile by taxonId (pure,
 * deterministic), and a missing index yields an empty one (nothing attached).
 */

import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applySilhouettes,
  loadSilhouetteIndex,
} from "../src/pipeline/silhouettes.js";
import type { ReadModel, ReadProfile } from "../src/domain/index.js";

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.map((d) => rm(d, { recursive: true, force: true })));
  tmps.length = 0;
});

test("applySilhouettes attaches paths by taxonId, leaves others null", () => {
  const model = {
    profiles: [
      { taxonId: "txn:1", silhouette: null } as unknown as ReadProfile,
      { taxonId: "txn:2", silhouette: null } as unknown as ReadProfile,
    ],
  } as unknown as ReadModel;
  const out = applySilhouettes(model, {
    human: "data/silhouettes/human.svg",
    taxa: { "txn:1": "data/silhouettes/abc.svg" },
  });
  expect(out.profiles[0]!.silhouette).toBe("data/silhouettes/abc.svg");
  expect(out.profiles[1]!.silhouette).toBeNull();
  // Input is not mutated (pure).
  expect(model.profiles[0]!.silhouette).toBeNull();
});

test("loadSilhouetteIndex returns an empty index when the file is missing", async () => {
  const idx = await loadSilhouetteIndex("/no/such/index.json");
  expect(idx).toEqual({ human: null, taxa: {} });
});

test("loadSilhouetteIndex parses a committed index", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sil-"));
  tmps.push(dir);
  const path = join(dir, "index.json");
  await writeFile(
    path,
    JSON.stringify({
      human: "data/silhouettes/human.svg",
      taxa: { "txn:1": "data/silhouettes/x.svg" },
    }),
  );
  const idx = await loadSilhouetteIndex(path);
  expect(idx.human).toBe("data/silhouettes/human.svg");
  expect(idx.taxa["txn:1"]).toBe("data/silhouettes/x.svg");
});
