/**
 * Build-time pageview fetcher (SPEC-020 REQ-001, NFR-002). For every genus in
 * the shipped snapshot with a resolved Wikipedia article, sums English Wikipedia
 * pageviews over a fixed 12-month window and writes `popularity/pageviews.json`.
 * This is the *only* place the pageviews API is contacted: the app build reads
 * the committed file and never egresses, so runtime stays offline (DATA-005).
 *
 *   pnpm run fetch:popularity              # fetch every article-bearing genus
 *   pnpm run fetch:popularity -- --limit 50   # first 50 (smoke test)
 *
 * It is deliberately **not** part of `pnpm run build`, and it is never run by a
 * test: an automatic refetch would silently reorder the well-known pool and
 * change future puzzles with nobody deciding to (SPEC-020 human decision,
 * 2026-08-11).
 *
 * Failure policy (NFR-002): an article that does not resolve, or a request that
 * fails after its retries, is recorded as `null` — never as a zero. A run with
 * no network reachable at all exits non-zero and leaves the previous cache
 * untouched, and the file is written atomically so an interrupted run cannot
 * leave a half-built cache behind.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadProfile, ReadTaxon } from "../src/domain/snapshot.js";
import { buildTaxonomyIndex } from "../src/app/state/taxonomy.js";
import { buildGameData } from "../src/app/state/dailyGenus.js";
import type { PopularityCache } from "../src/pipeline/popularity.js";
import { loadPopularityCache } from "../src/pipeline/popularity.js";

const API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";
const UA =
  "paleo-map-popularity/1.0 (https://github.com/Nelson-Jnrnd/paleo-map)";

/** The measured window. Twelve months damps a single news or film spike. */
const WINDOW_START = "2025080100";
const WINDOW_END = "2026080100";
const WINDOW_LABEL = "2025-08/2026-08";

/**
 * Politeness (NFR-002): bounded concurrency, a pause between batches, and a
 * backoff long enough to actually clear a rate limit.
 *
 * Measured 2026-08-11: at 6 concurrent with a 150 ms pause and two 0.5 s
 * retries, 373 of 985 articles came back unresolved — and every one of them
 * returned HTTP 200 when fetched on its own afterwards. They were throttled,
 * not missing. Since a null excludes a genus from the well-known pool, a weak
 * backoff does not just lose data, it quietly reshapes the track.
 */
const CONCURRENCY = 3;
const BATCH_PAUSE_MS = 300;
const RETRIES = 4;
const BACKOFF_BASE_MS = 1_000;

interface Ref {
  taxonId: string;
  name: string;
  title: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Throttle responses seen this run, reported so a bad run is visible. */
let throttled = 0;

/**
 * Total views for one article, or null when it cannot be established. A 404 is
 * a definitive "no data for this article" and is not retried; a transport error
 * or a 5xx is retried before giving up.
 */
async function fetchViews(title: string): Promise<number | null> {
  const url =
    `${API}/en.wikipedia/all-access/user/` +
    `${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${WINDOW_START}/${WINDOW_END}`;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      // Only a 404 is definitive: this article genuinely has no series.
      if (res.status === 404) return null;
      if (!res.ok) {
        if (attempt === RETRIES) return null;
        // Honour an explicit Retry-After; otherwise exponential backoff.
        const after = Number(res.headers.get("retry-after"));
        throttled++;
        await sleep(
          Number.isFinite(after) && after > 0
            ? after * 1000
            : BACKOFF_BASE_MS * 2 ** attempt,
        );
        continue;
      }
      const body = (await res.json()) as { items?: { views: number }[] };
      return (body.items ?? []).reduce((sum, item) => sum + item.views, 0);
    } catch {
      if (attempt === RETRIES) return null;
      await sleep(BACKOFF_BASE_MS * 2 ** attempt);
    }
  }
  return null;
}

async function main(): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Number(args[limitAt + 1] ?? "0") : 0;

  const reference = JSON.parse(
    await readFile(join(repoRoot, "public", "data", "reference.json"), "utf-8"),
  ) as {
    taxa: Array<{
      id: string;
      scientificName: string;
      rank: string;
      wikipedia?: { title: string } | null;
    }>;
    profiles: Array<{ taxonId: string }>;
  };

  // Exactly the answer pool, not every genus (REQ-001): a genus that can never
  // be an answer needs no ranking, and asking a public API for ~1,000 figures we
  // would not use is not politeness. Ranking itself happens in the app from the
  // committed numbers — this script makes no judgement about what is well known,
  // it only counts.
  const profilesById = new Map(
    (reference.profiles ?? []).map((p) => [p.taxonId, p]),
  );
  const gameData = buildGameData(
    reference.taxa as unknown as ReadTaxon[],
    buildTaxonomyIndex(reference.taxa as unknown as ReadTaxon[]),
    (id) => profilesById.get(id) as unknown as ReadProfile | undefined,
  );
  const taxaById = new Map(reference.taxa.map((t) => [t.id, t]));
  const refs: Ref[] = gameData.pool
    .map((id) => taxaById.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t?.wikipedia?.title))
    .map((t) => ({
      taxonId: t.id,
      name: t.scientificName,
      title: t.wikipedia!.title,
    }))
    .sort((a, b) => a.taxonId.localeCompare(b.taxonId));
  const targets = limit > 0 ? refs.slice(0, limit) : refs;

  const outDir = join(repoRoot, "popularity");
  const outPath = join(outDir, "pageviews.json");
  const previous = await loadPopularityCache(outPath);

  console.log(
    `Fetching ${targets.length} article(s) over ${WINDOW_LABEL} ` +
      `(${CONCURRENCY} at a time)…`,
  );

  const entries: Record<string, number | null> = {};
  let resolved = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const views = await Promise.all(batch.map((r) => fetchViews(r.title)));
    views.forEach((v, j) => {
      const ref = batch[j]!;
      entries[ref.taxonId] = v;
      if (v === null) failed++;
      else resolved++;
    });
    if (i > 0 && i % (CONCURRENCY * 25) === 0) {
      console.log(`  … ${i + batch.length}/${targets.length}`);
    }
    await sleep(BATCH_PAUSE_MS);
  }

  // A second, slower sweep over this run's nulls. A throttled request is not a
  // missing article, and a null silently drops a genus from the well-known pool
  // — so it is worth one patient retry before accepting it.
  const stragglers = targets.filter((r) => entries[r.taxonId] === null);
  if (stragglers.length > 0) {
    console.log(
      `Retrying ${stragglers.length} unresolved article(s), one at a time…`,
    );
    for (const ref of stragglers) {
      const v = await fetchViews(ref.title);
      if (v !== null) {
        entries[ref.taxonId] = v;
        resolved++;
        failed--;
      }
      await sleep(BATCH_PAUSE_MS * 2);
    }
  }

  // Nothing resolved at all: treat it as "no network" rather than as a snapshot
  // in which nobody reads about dinosaurs, and leave the cache alone (NFR-002).
  if (resolved === 0 && targets.length > 0) {
    console.error(
      `No article resolved out of ${targets.length}. Leaving ${outPath} untouched.`,
    );
    process.exitCode = 1;
    return;
  }

  // A partial run must not drop figures the previous run established.
  const merged: Record<string, number | null> = { ...previous.entries };
  for (const [taxonId, views] of Object.entries(entries)) {
    if (views !== null || !(taxonId in merged)) merged[taxonId] = views;
  }

  const cache: PopularityCache = {
    window: WINDOW_LABEL,
    retrievedOn: new Date().toISOString().slice(0, 10),
    // Sorted so the committed file diffs cleanly between runs.
    entries: Object.fromEntries(
      Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };

  await mkdir(outDir, { recursive: true });
  // Atomic: write beside, then rename, so an interrupted run cannot leave a
  // half-written cache in place (NFR-002).
  const tmpPath = `${outPath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(cache, null, 2)}\n`, "utf-8");
  await rename(tmpPath, outPath);

  const ranked = Object.entries(cache.entries)
    .filter((e): e is [string, number] => typeof e[1] === "number")
    .sort((a, b) => b[1] - a[1]);
  const nameById = new Map(refs.map((r) => [r.taxonId, r.name]));
  const at = (i: number): string => {
    const row = ranked[i];
    return row
      ? `${nameById.get(row[0]) ?? row[0]} ${row[1].toLocaleString("en-GB")}`
      : "—";
  };
  console.log(
    `\nWrote ${outPath}\n` +
      `  ${resolved} resolved, ${failed} unresolved (recorded as null), ${throttled} throttle response(s)\n` +
      `  #1 ${at(0)} · #50 ${at(49)} · #100 ${at(99)} · #250 ${at(249)} · #400 ${at(399)}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
