/**
 * Shrink and pre-mask the bundled clade silhouettes (SPEC-015 NFR-002).
 *
 * The artwork arrived as ~1254 px opaque-white-backed PNGs (5.8 MB total) but the
 * app never draws a clade icon larger than the taxon profile's 220 px fallback
 * panel — the map draws them at 22–40 px, the legend at 16 px, the cards at 22 px.
 * Shipping the full-resolution rasters cost the download *and* forced the app to
 * strip the white background in the browser on every load.
 *
 * This bakes both steps into the committed assets:
 *   1. strip the opaque near-white background to transparency (the exact
 *      threshold `OccurrenceMap` used to apply at runtime), then
 *   2. downscale by `DOWNSCALE` — masking first so the browser's premultiplied
 *      -alpha filtering leaves clean edges instead of a grey halo.
 *
 * Every asset is divided by the *same* factor, so the icons keep their relative
 * proportions and the map's `icon-size` values stay exact (see `ICON_SIZE_SCALE`
 * in `OccurrenceMap.tsx` — it must equal the total shrink applied to the artwork).
 *
 * Idempotent: a file already at its target size is left untouched, so re-running
 * never shrinks twice. Chromium (already a dev dependency via Playwright) does the
 * pixel work, so the offline result matches the canvas path byte-for-byte in
 * approach. Build-time only — the app ships the committed output (DATA-005).
 *
 *   pnpm run shrink:clade-icons
 */

import { chromium } from "@playwright/test";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Uniform divisor applied to every clade asset. Mirrors ICON_ASSET_DOWNSCALE. */
const DOWNSCALE = 3;

/** Alpha-strip threshold: a pixel this bright in all channels is background. */
const WHITE_THRESHOLD = 238;

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "assets",
  "clades",
);

/** PNG IHDR: width/height are big-endian u32 at byte 16 and 20. */
function pngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function main(): Promise<void> {
  const files = (await readdir(ASSETS)).filter((f) => f.endsWith(".png"));
  if (files.length === 0) {
    console.log("no clade PNGs found");
    return;
  }

  // Honour an explicit Chromium binary (CI images and sandboxes often ship one
  // that Playwright's own version pin doesn't match); otherwise use the default.
  const executable = process.env["CHROMIUM_EXECUTABLE"];
  const browser = await chromium.launch(
    executable ? { executablePath: executable } : {},
  );
  const page = await browser.newPage();

  let before = 0;
  let after = 0;
  for (const file of files) {
    const path = join(ASSETS, file);
    const original = await readFile(path);
    const { width, height } = pngSize(original);
    before += original.byteLength;

    const target = {
      width: Math.max(1, Math.round(width / DOWNSCALE)),
      height: Math.max(1, Math.round(height / DOWNSCALE)),
    };
    // Already shrunk (a previous run): leave it alone so this stays idempotent.
    if (width <= target.width * 2) {
      console.log(
        `  ${file.padEnd(26)} ${width}x${height} — already shrunk, skipped`,
      );
      after += original.byteLength;
      continue;
    }

    const dataUrl = `data:image/png;base64,${original.toString("base64")}`;
    const out = await page.evaluate(
      async ({ dataUrl, target, threshold }) => {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("decode failed"));
          img.src = dataUrl;
        });
        const full = document.createElement("canvas");
        full.width = img.naturalWidth;
        full.height = img.naturalHeight;
        const fullCtx = full.getContext("2d");
        if (!fullCtx) throw new Error("no 2d context");
        fullCtx.drawImage(img, 0, 0);
        const image = fullCtx.getImageData(0, 0, full.width, full.height);
        const d = image.data;
        for (let i = 0; i < d.length; i += 4) {
          if (
            d[i]! > threshold &&
            d[i + 1]! > threshold &&
            d[i + 2]! > threshold
          ) {
            d[i + 3] = 0;
          }
        }
        fullCtx.putImageData(image, 0, 0);

        const small = document.createElement("canvas");
        small.width = target.width;
        small.height = target.height;
        const ctx = small.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(full, 0, 0, target.width, target.height);
        return small.toDataURL("image/png");
      },
      { dataUrl, target, threshold: WHITE_THRESHOLD },
    );

    const bytes = Buffer.from(out.split(",")[1]!, "base64");
    await writeFile(path, bytes);
    after += bytes.byteLength;
    console.log(
      `  ${file.padEnd(26)} ${width}x${height} -> ${target.width}x${target.height}  ` +
        `${(original.byteLength / 1024).toFixed(0)} KB -> ${(bytes.byteLength / 1024).toFixed(0)} KB`,
    );
  }

  await browser.close();
  console.log(
    `\nclade icons: ${(before / 1024 / 1024).toFixed(2)} MB -> ${(after / 1024 / 1024).toFixed(2)} MB`,
  );
}

await stat(ASSETS);
await main();
