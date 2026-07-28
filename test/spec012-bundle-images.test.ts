/**
 * SPEC-012 REQ-002 — image bundling. The web-data generator downloads each
 * showable profile image into data/images/ and rewrites its imageUrl to the
 * local path; images that fail to download are cleared so the UI falls back to a
 * silhouette. Filenames are deterministic (NFR-002).
 */

import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleImages, imageFileName } from "../scripts/bundle_images.js";
import type { ReferenceModel } from "../src/pipeline/partition.js";

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.map((d) => rm(d, { recursive: true, force: true })));
  tmps.length = 0;
});

async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "imgtest-"));
  tmps.push(d);
  return d;
}

test("imageFileName is deterministic and keeps a real extension", () => {
  const a = imageFileName("src:wp:Q1", "https://x/320px-Foo.jpg");
  expect(a).toBe(imageFileName("src:wp:Q1", "https://x/320px-Foo.jpg"));
  expect(a).toMatch(/^src_wp_Q1-[0-9a-f]{8}\.jpg$/);
  // Unknown/mangled extension defaults to jpg; png is preserved.
  expect(imageFileName("s", "https://x/thumb?token=1")).toMatch(/\.jpg$/);
  expect(imageFileName("s", "https://x/a.png")).toMatch(/\.png$/);
});

test("bundles downloadable images locally and clears failures", async () => {
  const outDir = await tmp();
  const reference = {
    profiles: [
      {
        taxonId: "t1",
        images: [
          { imageUrl: "https://x/y.jpg", sourceId: "src:wp:Q1" },
          { imageUrl: "https://x/fail.png", sourceId: "src:wp:Q2" },
          { imageUrl: "data/images/already.jpg", sourceId: "src:wp:Q3" },
        ],
      },
    ],
  } as unknown as ReferenceModel;

  const bundled = await bundleImages(reference, outDir, async (url) =>
    url.includes("fail") ? null : new Uint8Array([1, 2, 3]),
  );

  expect(bundled).toBe(1);
  const imgs = reference.profiles[0]!.images;
  // Downloaded → rewritten to a local path and written to disk.
  expect(imgs[0]!.imageUrl).toBe(
    `data/images/${imageFileName("src:wp:Q1", "https://x/y.jpg")}`,
  );
  const written = await readdir(join(outDir, "images"));
  expect(written).toContain(imageFileName("src:wp:Q1", "https://x/y.jpg"));
  // Failed download → cleared to trigger the silhouette fallback.
  expect(imgs[1]!.imageUrl).toBe("");
  // Already-local URL → untouched.
  expect(imgs[2]!.imageUrl).toBe("data/images/already.jpg");
});

test("always bundles the lead image, caps gallery extras by total bytes (SPEC-014)", async () => {
  const outDir = await tmp();
  const reference = {
    profiles: [
      {
        taxonId: "t1",
        images: [
          { imageUrl: "https://x/lead.jpg", sourceId: "src:wp:Q1" }, // lead
          { imageUrl: "https://x/extra1.jpg", sourceId: "src:wp:Q1" }, // extra
          { imageUrl: "https://x/extra2.jpg", sourceId: "src:wp:Q1" }, // extra
        ],
      },
    ],
  } as unknown as ReferenceModel;

  // 10 bytes each; cap 15 → lead (always) + one extra fit; the second extra is
  // dropped once the running total reaches the cap.
  const bundled = await bundleImages(
    reference,
    outDir,
    async () => new Uint8Array(10),
    undefined,
    15,
  );

  expect(bundled).toBe(2);
  const imgs = reference.profiles[0]!.images;
  expect(imgs[0]!.imageUrl).toMatch(/^data\/images\//); // lead bundled
  expect(imgs[1]!.imageUrl).toMatch(/^data\/images\//); // first extra fits
  expect(imgs[2]!.imageUrl).toBe(""); // budget spent → dropped
});
