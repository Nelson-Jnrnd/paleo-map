/**
 * Generate the web app's static data artifacts (SPEC-008 REQ-005; SPEC-002
 * REQ-006). Builds the SPEC-001 read model, then partitions it by stage into the
 * artifacts the app actually fetches:
 *
 *   public/data/index.json          — boot index (stages → data/basemap URLs, counts, bounds)
 *   public/data/reference.json      — shared metadata + sources + taxa + profiles
 *   public/data/stage-<slug>.json   — { occurrences } for each stage with data
 *
 * Vite serves/bundles these verbatim; the app fetches the index and reference at
 * boot and only the active stage's file thereafter — no backend, no upstream
 * egress at read time (SPEC-001 DATA-005).
 *
 *   pnpm run gen:web-data            # committed fixture (offline, deterministic)
 *   pnpm run snapshot:app            # live full-Mesozoic PBDB pull (--live)
 *
 * The committed artifacts are the SHIPPED dataset (a real PBDB pull); refresh
 * them with the live mode. Unit tests build from the fixture client directly, so
 * they stay deterministic regardless of the shipped artifacts.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceClient } from "../src/pipeline/sources.js";
import { buildReadModel, serializeCompact } from "../src/pipeline/build.js";
import { partitionReadModel } from "../src/pipeline/partition.js";
import type { ReconstructionCache } from "../src/pipeline/reconstruction.js";
import { FixtureSourceClient } from "../src/pipeline/fixture-client.js";
import { HttpSourceClient } from "../src/pipeline/http-client.js";
import { bundleImages } from "./bundle_images.js";
import {
  applyEnrichment,
  loadEnrichmentCache,
} from "../src/pipeline/enrichment.js";
import {
  applySilhouettes,
  loadSilhouetteIndex,
} from "../src/pipeline/silhouettes.js";
import {
  applyWikipedia,
  loadWikipediaResolution,
} from "../src/pipeline/wikipedia.js";
import {
  applyPopularity,
  loadPopularityCache,
} from "../src/pipeline/popularity.js";

/** Load the committed reconstruction cache; an absent file yields an empty cache. */
async function loadReconstructionCache(
  path: string,
): Promise<ReconstructionCache> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as ReconstructionCache;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const live = process.argv.slice(2).includes("--live");
  const client: SourceClient = live
    ? new HttpSourceClient({ baseName: "Dinosauria" })
    : new FixtureSourceClient();
  if (live)
    console.log(
      "Ingesting live full-Mesozoic (Triassic/Jurassic/Cretaceous) from PBDB + Wikidata + Wikipedia/Commons…",
    );

  const baseModel = await buildReadModel(client);

  // SPEC-014 REQ-002: attach the committed enrichment cache (agent-authored by
  // default). Read-only and offline — no LLM call here; a build with an empty
  // cache simply ships no enrichment. A malformed cache file fails the build.
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const enrichmentDir = join(repoRoot, "enrichment");
  const cache = await loadEnrichmentCache(enrichmentDir);
  const enrichedModel = applyEnrichment(baseModel, cache);
  const enriched = enrichedModel.profiles.filter(
    (p) => p.enrichment !== null,
  ).length;
  console.log(
    `Enrichment: ${cache.size} cached record(s) → ${enriched} profile(s) enriched`,
  );

  // SPEC-014 REQ-004: attach the committed PhyloPic silhouette index (bundled
  // SVGs under public/data/silhouettes/). Offline — no PhyloPic calls here.
  const silhouettes = await loadSilhouetteIndex(
    join(repoRoot, "silhouettes", "index.json"),
  );
  const silhouettedModel = applySilhouettes(enrichedModel, silhouettes);
  const withSil = silhouettedModel.profiles.filter(
    (p) => p.silhouette !== null,
  ).length;
  console.log(
    `Silhouettes: ${Object.keys(silhouettes.taxa).length} indexed → ${withSil} profile(s) with a PhyloPic silhouette`,
  );

  // SPEC-014 AMEND-005: attach the committed Wikipedia resolution
  // (wikipedia/resolution.json, produced by scripts/resolve_wikipedia.ts).
  // Read-only and offline — no MediaWiki call here; taxa without an entry are
  // article-less and hidden by default in the app.
  const resolution = await loadWikipediaResolution(
    join(repoRoot, "wikipedia", "resolution.json"),
  );
  const wikiModel = applyWikipedia(silhouettedModel, resolution);
  const withWiki = wikiModel.taxa.filter((t) => t.wikipedia != null).length;
  console.log(
    `Wikipedia: ${Object.keys(resolution.entries).length} resolved entr(ies) → ${withWiki} taxon(a) with an article`,
  );

  // SPEC-020 REQ-001: attach the committed pageview cache
  // (popularity/pageviews.json, produced by scripts/fetch_popularity.ts).
  // Read-only and offline — no pageviews call here; an absent cache simply means
  // no popularity, and the well-known track is not offered (REQ-008).
  const popularity = await loadPopularityCache(
    join(repoRoot, "popularity", "pageviews.json"),
  );
  const model = applyPopularity(wikiModel, popularity);
  const withViews = model.profiles.filter((p) => p.popularity !== null).length;
  console.log(
    `Popularity: ${Object.keys(popularity.entries).length} cached figure(s) → ${withViews} profile(s) ranked` +
      (popularity.window ? ` (${popularity.window})` : ""),
  );

  const outDir = join(repoRoot, "public", "data");
  await mkdir(outDir, { recursive: true });

  // SPEC-016 REQ-001: apply the committed frame-consistent reconstruction cache so
  // each stage's occurrences are placed at that stage's coastline age. Read-only
  // and offline — the cache is refreshed separately by scripts/reconstruct_occurrences.ts.
  // An absent/empty cache leaves occurrences at their source (collection-age) position.
  const reconstructions = await loadReconstructionCache(
    join(repoRoot, "reconstructions", "cache.json"),
  );
  console.log(
    `Reconstruction: ${Object.keys(reconstructions).length} cached frame-age point(s)`,
  );

  const partition = partitionReadModel(model, undefined, reconstructions);

  // Clear stale artifacts (the old single snapshot.json and any previous stage
  // files) so the emitted set is exactly the current partitioning.
  for (const name of await readdir(outDir).catch(() => [])) {
    if (name === "snapshot.json" || name.startsWith("stage-")) {
      await rm(join(outDir, name));
    }
  }

  // SPEC-012 REQ-002 / SPEC-014 REQ-003: bundle profile images into data/images/
  // and rewrite their imageUrl to local paths, so pictures are served offline
  // with no runtime egress. Only in live mode — the committed fixture URLs are
  // not real. A total-bytes cap keeps the gallery from ballooning the repo: every
  // taxon's lead image is always bundled, gallery extras only until the cap.
  const IMAGES_TOTAL_CAP_BYTES = 90 * 1024 * 1024;
  if (live) {
    // Wikimedia throttles rapid *bursts* of downloads (the images succeed in
    // isolation), so pace requests ~4/sec and retry the occasional throttle with
    // longer backoff, sending a descriptive User-Agent.
    const UA =
      "MesozoicDinosaurAtlas/1.0 (https://github.com/Nelson-Jnrnd/paleo-map)";
    const sleep = (ms: number): Promise<void> =>
      new Promise((r) => setTimeout(r, ms));
    const bundled = await bundleImages(
      partition.reference,
      outDir,
      async (url) => {
        // Wikimedia burst-throttles (429) even when every file is available, so
        // be patient: a steady ~3/sec base pace, then exponential backoff on a
        // throttle/5xx across several attempts. Only a real 4xx (404/403) gives up.
        for (let attempt = 1; attempt <= 5; attempt++) {
          await sleep(attempt === 1 ? 350 : 2000 * 2 ** (attempt - 2));
          try {
            const res = await fetch(url, { headers: { "User-Agent": UA } });
            if (res.ok) return new Uint8Array(await res.arrayBuffer());
            // Permanent failure (404/403/…) — give up; transient — retry.
            if (res.status !== 429 && res.status < 500) return null;
          } catch {
            /* network blip — retry */
          }
        }
        return null;
      },
      (msg) => console.log(msg),
      IMAGES_TOTAL_CAP_BYTES,
    );
    console.log(
      `Bundled ${bundled} profile image(s) → ${join(outDir, "images")}`,
    );
  }

  await writeFile(
    join(outDir, "index.json"),
    serializeCompact(partition.index),
    "utf-8",
  );
  await writeFile(
    join(outDir, "reference.json"),
    serializeCompact(partition.reference),
    "utf-8",
  );
  // SPEC-014 AMEND-004: enrichment ships as its own artifact so the reference
  // budget stays fixed while enrichment scales to every genus.
  await writeFile(
    join(outDir, "enrichment.json"),
    serializeCompact(partition.enrichment),
    "utf-8",
  );
  for (const stage of partition.stages) {
    await writeFile(
      join(outDir, `stage-${stage.slug}.json`),
      serializeCompact({ occurrences: stage.occurrences }),
      "utf-8",
    );
  }

  const withData = partition.index.stages.filter((s) => s.occurrenceCount > 0);
  console.log(
    `Wrote partitioned web data → ${outDir}\n` +
      `  index.json + reference.json + enrichment.json (${model.taxa.length} taxa, ${model.profiles.length} profiles, ${Object.keys(partition.enrichment).length} enriched)\n` +
      `  ${withData.length}/${partition.index.stages.length} stages with occurrences, ` +
      `${model.occurrences.length} occurrences total (retrievedOn ${model.metadata.retrievedOn})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
