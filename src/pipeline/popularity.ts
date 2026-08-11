/**
 * Popularity cache (SPEC-020 REQ-001, DATA-001). How often each genus's English
 * Wikipedia article was read over a fixed window, fetched **once at build time**
 * by `scripts/fetch_popularity.ts` and committed to `popularity/pageviews.json`.
 * The build only ever *reads* the committed file and never calls the network, so
 * the snapshot stays deterministic and runtime stays offline (DATA-005,
 * SPEC-020 NFR-001).
 *
 * The figure ranks the well-known track and nothing else. It is an assertion
 * about **human attention in one language over one window** — not about
 * scientific importance, completeness of the fossil record, or how well studied
 * an animal is — and the product's wording must say so (SPEC-020 UX-001/UX-002).
 *
 * A taxon whose article does not resolve, or whose fetch failed, is `null`
 * rather than `0`: a zero would rank a real genus as unread, whereas null says
 * we do not know and leaves it out of the track (REQ-001).
 */

import { readFile } from "node:fs/promises";
import type { PopularityProvenance, ReadModel } from "../domain/snapshot.js";

/** The source recorded for every popularity figure. */
export const POPULARITY_SOURCE_ID = "src:wikimedia-pageviews";

/** The committed cache: one provenance envelope + `taxonId → views | null`. */
export interface PopularityCache {
  /** The measured window, e.g. "2025-08/2026-08". */
  window: string;
  /** ISO date the counts were fetched. */
  retrievedOn: string;
  /** `taxonId → total views in the window`; `null` where unresolved. */
  entries: Record<string, number | null>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate a parsed cache file, throwing on a malformed shape. */
export function parsePopularityCache(value: unknown): PopularityCache {
  if (!isObject(value)) throw new Error("popularity: root must be an object");
  if (typeof value.window !== "string" || value.window.length === 0) {
    throw new Error("popularity: window must be a non-empty string");
  }
  if (
    typeof value.retrievedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}/.test(value.retrievedOn)
  ) {
    throw new Error("popularity: retrievedOn must be an ISO date string");
  }
  if (!isObject(value.entries)) {
    throw new Error("popularity: entries must be an object");
  }
  for (const [taxonId, views] of Object.entries(value.entries)) {
    if (views === null) continue;
    if (typeof views !== "number" || !Number.isFinite(views) || views < 0) {
      throw new Error(
        `popularity: entries["${taxonId}"] must be null or a non-negative number`,
      );
    }
  }
  return value as unknown as PopularityCache;
}

/**
 * Load and validate the committed cache. A missing file yields an empty cache —
 * nothing is popular, the well-known track is simply not offered (REQ-008) — so
 * a build never fails just because the fetch has not been run.
 */
export async function loadPopularityCache(
  path: string,
): Promise<PopularityCache> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    return { window: "", retrievedOn: "1970-01-01", entries: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`popularity: ${path} is not valid JSON — ${String(err)}`);
  }
  return parsePopularityCache(parsed);
}

/** True when the cache carries no usable figure at all. */
export function isEmptyCache(cache: PopularityCache): boolean {
  return Object.values(cache.entries).every((v) => v === null);
}

/**
 * Attach popularity to a model's profiles by taxonId (DATA-001). Pure: returns a
 * new model, sets `null` where the cache has no figure, and records the window,
 * date and source **once** on the metadata rather than on every profile.
 * Deterministic given the committed file — no network.
 */
export function applyPopularity(
  model: ReadModel,
  cache: PopularityCache,
): ReadModel {
  const provenance: PopularityProvenance = {
    window: cache.window,
    retrievedOn: cache.retrievedOn,
    sourceId: POPULARITY_SOURCE_ID,
  };
  const empty = isEmptyCache(cache);
  const metadata = { ...model.metadata };
  if (empty) delete metadata.popularity;
  else metadata.popularity = provenance;

  return {
    ...model,
    metadata,
    /**
     * The cache is **authoritative**, not additive (REQ-001: "the value in the
     * read model equals the value in the cache"). Applying a cache that no
     * longer knows a taxon clears the old figure rather than leaving a stale one
     * behind — otherwise re-applying a pruned cache would silently keep genera
     * in the well-known track on numbers nothing can account for.
     *
     * Only profiles with an established figure carry the field: an explicit null
     * on every other profile would cost more than the figures do, and says
     * nothing the absent key does not (DATA-001).
     */
    profiles: model.profiles.map((p) => {
      const views = cache.entries[p.taxonId];
      if (typeof views === "number") return { ...p, popularity: views };
      if (!("popularity" in p)) return p;
      const rest = { ...p };
      delete rest.popularity;
      return rest;
    }),
  };
}
