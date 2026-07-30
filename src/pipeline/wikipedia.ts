/**
 * Wikipedia article resolution cache (SPEC-014 AMEND-005). Which taxa have a
 * Wikipedia article — and each one's canonical title + URL — is resolved **once
 * at build time** against the MediaWiki API (`scripts/resolve_wikipedia.ts`) and
 * committed to `wikipedia/resolution.json`. The build only ever **reads** this
 * committed file and never calls the network, so the snapshot stays deterministic
 * and runtime stays offline (DATA-005): the resolved `url` is what the inline
 * taxon page iframe loads.
 *
 * This module is the cache shape + loader + apply step. A taxon whose entry is
 * `null` (or absent) has no article: it is hidden by default and never navigable
 * (AMEND-005).
 */

import { readFile } from "node:fs/promises";
import type { ReadModel, WikipediaRef } from "../domain/snapshot.js";

/** The committed resolution file: provenance date + `taxonId → ref | null`. */
export interface WikipediaResolution {
  /** ISO date the resolution was run (freshness/provenance). */
  resolvedOn: string;
  /** `taxonId → { title, url }` for taxa with an article; `null` for none. */
  entries: Record<string, WikipediaRef | null>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate a parsed resolution file, throwing on a malformed shape. */
export function parseResolution(value: unknown): WikipediaResolution {
  if (!isObject(value))
    throw new Error("wikipedia resolution: root must be an object");
  if (
    typeof value.resolvedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}/.test(value.resolvedOn)
  ) {
    throw new Error(
      "wikipedia resolution: resolvedOn must be an ISO date string",
    );
  }
  if (!isObject(value.entries))
    throw new Error("wikipedia resolution: entries must be an object");
  for (const [taxonId, ref] of Object.entries(value.entries)) {
    if (ref === null) continue;
    if (
      !isObject(ref) ||
      typeof ref.title !== "string" ||
      ref.title.length === 0 ||
      typeof ref.url !== "string" ||
      !ref.url.startsWith("http")
    ) {
      throw new Error(
        `wikipedia resolution: entries["${taxonId}"] must be null or { title, url:http(s) }`,
      );
    }
  }
  return value as unknown as WikipediaResolution;
}

/**
 * Load and validate the committed resolution file. A missing file yields an empty
 * resolution (nothing resolved — every taxon is treated as article-less), so the
 * build never fails just because resolution hasn't been run yet.
 */
export async function loadWikipediaResolution(
  path: string,
): Promise<WikipediaResolution> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    return { resolvedOn: "1970-01-01", entries: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `wikipedia resolution: ${path} is not valid JSON — ${String(err)}`,
    );
  }
  return parseResolution(parsed);
}

/**
 * Attach resolved Wikipedia refs to a read model's taxa by taxonId (AMEND-005).
 * Pure: returns a new model with `taxon.wikipedia` set from the resolution (or
 * `null` where the resolution has no entry). Deterministic given the committed
 * file — no network.
 */
export function applyWikipedia(
  model: ReadModel,
  resolution: WikipediaResolution,
): ReadModel {
  return {
    ...model,
    taxa: model.taxa.map((t) => ({
      ...t,
      wikipedia: resolution.entries[t.id] ?? null,
    })),
  };
}
