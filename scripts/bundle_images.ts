/**
 * Bundle taxon-profile lead images into the static artifact (SPEC-012 REQ-002,
 * owner-chosen delivery = bundle). At build time each showable image's remote
 * Commons thumbnail is downloaded into `public/data/images/` and its `imageUrl`
 * rewritten to the local, app-relative path, so the app serves pictures with no
 * runtime egress and works offline (SPEC-001 DATA-005). Images that fail to
 * download have their `imageUrl` cleared, so the profile falls back to a clade
 * silhouette rather than a broken image (SPEC-012 error handling).
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReferenceModel } from "../src/pipeline/partition.js";

const IMG_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

/**
 * Deterministic local filename for a bundled image (NFR-002): the sanitised
 * image source id plus a short content-address of the URL, keeping a real image
 * extension. Pure — same inputs always yield the same name.
 */
export function imageFileName(sourceId: string, imageUrl: string): string {
  const safe = sourceId.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const hash = createHash("sha1").update(imageUrl).digest("hex").slice(0, 8);
  const last = (imageUrl.split("?")[0] ?? "").split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  const raw = dot >= 0 ? last.slice(dot + 1).toLowerCase() : "";
  const ext = IMG_EXTS.has(raw) ? raw : "jpg";
  return `${safe}-${hash}.${ext}`;
}

/** Fetch image bytes, or null when the resource is unavailable. */
export type ImageFetcher = (url: string) => Promise<Uint8Array | null>;

/**
 * Download every remote profile image into `<outDir>/images` and rewrite its
 * `imageUrl` to the local path. Mutates `reference.profiles` in place and
 * returns the number of images bundled. The images directory is reset first so
 * the emitted set is exactly the current one (deterministic).
 */
export async function bundleImages(
  reference: ReferenceModel,
  outDir: string,
  fetchImage: ImageFetcher,
  log: (msg: string) => void = () => {},
  maxTotalBytes: number = Number.POSITIVE_INFINITY,
): Promise<number> {
  const imagesDir = join(outDir, "images");
  await rm(imagesDir, { recursive: true, force: true });
  await mkdir(imagesDir, { recursive: true });

  type Img = ReferenceModel["profiles"][number]["images"][number];

  // Every taxon's first remote image is a "lead" (always bundled); the rest are
  // gallery "extras", bundled only until the total-bytes budget is reached — so
  // repo size stays bounded regardless of gallery coverage (SPEC-014 REQ-003).
  const lead: Img[] = [];
  const extra: Img[] = [];
  for (const profile of reference.profiles) {
    let isFirst = true;
    for (const img of profile.images) {
      if (!/^https?:/i.test(img.imageUrl)) continue; // already local, or empty
      (isFirst ? lead : extra).push(img);
      isFirst = false;
    }
  }

  let bundled = 0;
  let totalBytes = 0;
  const bundleOne = async (img: Img, budgeted: boolean): Promise<void> => {
    if (budgeted && totalBytes >= maxTotalBytes) {
      img.imageUrl = ""; // budget spent → drop this gallery extra
      return;
    }
    const bytes = await fetchImage(img.imageUrl);
    if (!bytes) {
      log(`  ! image unavailable, using silhouette fallback: ${img.imageUrl}`);
      img.imageUrl = "";
      return;
    }
    const name = imageFileName(img.sourceId, img.imageUrl);
    await writeFile(join(imagesDir, name), bytes);
    img.imageUrl = `data/images/${name}`;
    totalBytes += bytes.length;
    bundled++;
  };

  for (const img of lead) await bundleOne(img, false);
  for (const img of extra) await bundleOne(img, true);
  return bundled;
}
