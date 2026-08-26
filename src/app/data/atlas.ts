/**
 * Stage-partitioned atlas loading (SPEC-008 REQ-005; NFR-001/003; SPEC-006
 * UX-002). The app boots by fetching a small **index** and the shared
 * **reference** document (metadata + sources + taxa + profiles), then fetches
 * **only the active stage's** occurrence file — and one more file per timeline
 * step. Every fetch is a `fetch` of our own bundled artifacts; no upstream host
 * is contacted at runtime (DATA-005).
 *
 * The reference is the large boot download, so it is streamed with progress
 * (SPEC-006), reusing the same `progressRatio` contract as the legacy single
 * snapshot. Per-stage fetches accept an `AbortSignal` so rapid stepping can
 * cancel superseded requests (no stale render — SPEC-008 edge case).
 */

import { ReadApi } from "../../read/api.js";
import type {
  GeologicalStage,
  ReadModel,
  ReadOccurrence,
} from "../../domain/index.js";
import type {
  AtlasIndex,
  AtlasStageEntry,
  EnrichmentMap,
  ReferenceModel,
} from "../../pipeline/partition.js";
import type { GeographyIndex } from "../../pipeline/geography.js";
import { progressRatio } from "./snapshot.js";
import type { ProgressCallback } from "./snapshot.js";

export type { AtlasIndex, AtlasStageEntry, ReferenceModel };

/** Default boot index path, relative to the served app root. */
export const INDEX_URL = "data/index.json";

/**
 * The per-taxon country index (SPEC-028 DATA-001). A module constant rather than
 * a field on `index.json`, because `index.json` is produced by `gen:web-data`
 * and adding a field to it would mean regenerating the shipped artifacts.
 */
export const GEOGRAPHY_URL = "data/geography.json";

export interface AtlasBoot {
  index: AtlasIndex;
  reference: ReferenceModel;
  /**
   * The country index, or null when it could not be loaded (SPEC-028 UX-003) —
   * the puzzle then withholds the country clue and says why, and nothing else in
   * the app is affected.
   */
  geography: GeographyIndex | null;
}

/** The per-stage occurrence file shape (`stage-<slug>.json`). */
interface StageFile {
  occurrences: ReadOccurrence[];
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    throw new Error(`Load failed for ${url} (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as T;
}

/** Streamed JSON fetch that reports byte progress (SPEC-006 UX-002). */
async function fetchJsonStreamed<T>(
  url: string,
  onProgress?: ProgressCallback,
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Load failed for ${url} (${res.status} ${res.statusText})`);
  }
  const total = res.headers.get("Content-Length")
    ? Number(res.headers.get("Content-Length"))
    : undefined;

  if (!res.body || typeof res.body.getReader !== "function") {
    onProgress?.({ phase: "downloading", totalBytes: total });
    const value = (await res.json()) as T;
    onProgress?.({ phase: "preparing", totalBytes: total });
    return value;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.length;
    onProgress?.({
      phase: "downloading",
      receivedBytes: received,
      totalBytes: total,
      ratio: progressRatio(received, total),
    });
  }
  onProgress?.({
    phase: "preparing",
    receivedBytes: received,
    totalBytes: total,
    ratio: total ? 1 : undefined,
  });

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(buffer)) as T;
}

/**
 * Boot the atlas: fetch the index, the shared reference (streamed), and the
 * enrichment map (SPEC-014 AMEND-004), then fold enrichment back onto the
 * profiles so every downstream consumer sees a single, complete reference.
 * Those three are required before the exploration view can render.
 *
 * The country index (SPEC-028 DATA-001) is fetched here too, but is **not**
 * required: it feeds one clue channel in the puzzle, so it is loaded tolerantly
 * and its absence is a designed state rather than a boot failure. Loading it at
 * boot rather than on the puzzle screen is what keeps SPEC-019 NFR-001 ("the
 * game performs no network I/O") literally true — 48 KB against a 7.3 MB
 * reference.
 *
 * Enrichment is split into its own artifact so the reference budget stays fixed
 * as coverage scales to every genus; merging it here keeps `ReferenceModel` the
 * one shape the read API and components already depend on.
 */
export async function bootAtlas(
  onProgress?: ProgressCallback,
  indexUrl: string = INDEX_URL,
): Promise<AtlasBoot> {
  const index = await fetchJson<AtlasIndex>(indexUrl);
  const reference = await fetchJsonStreamed<ReferenceModel>(
    index.referenceUrl,
    onProgress,
  );
  const enrichment = await fetchJson<EnrichmentMap>(index.enrichmentUrl);
  return {
    index,
    reference: mergeEnrichment(reference, enrichment),
    geography: await fetchGeography(),
  };
}

/**
 * Fetch the country index (SPEC-028 DATA-001), tolerantly. Unlike the index,
 * reference and enrichment, this artifact is **not** required to render the
 * app: it feeds one clue channel in the puzzle. So a missing, unreachable or
 * malformed file yields null and the boot continues — SPEC-028 UX-003 then has
 * the puzzle withhold that channel *with its reason stated*, which is a designed
 * state rather than a failure.
 *
 * A shape check, not just a parse: a file that is valid JSON but not this index
 * would otherwise surface as undefined lookups at play time instead of as a
 * clean absence here.
 */
export async function fetchGeography(
  url: string = GEOGRAPHY_URL,
): Promise<GeographyIndex | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as GeographyIndex).countriesByTaxon !== "object" ||
      (parsed as GeographyIndex).countriesByTaxon === null
    ) {
      return null;
    }
    return parsed as GeographyIndex;
  } catch {
    return null;
  }
}

/**
 * Fold the enrichment map back onto the reference profiles. Profiles carry a
 * nulled `enrichment` slot when served; here we restore the record for every
 * profile the map covers, leaving the rest null (extract, don't invent).
 */
export function mergeEnrichment(
  reference: ReferenceModel,
  enrichment: EnrichmentMap,
): ReferenceModel {
  return {
    ...reference,
    profiles: reference.profiles.map((p) => {
      const record = enrichment[p.taxonId];
      return record ? { ...p, enrichment: record } : p;
    }),
  };
}

/**
 * The reference as a full read model with an empty occurrence set, plus the
 * whole-snapshot country index when one was loaded (SPEC-028 DATA-001). The
 * index is attached here rather than per stage because it is a snapshot-wide
 * aggregate: `withOccurrences` swaps the stage's occurrences and spreads the
 * rest of the model, so the countries survive every timeline step.
 */
export function referenceModel(
  reference: ReferenceModel,
  geography?: GeographyIndex | null,
): ReadModel {
  const model: ReadModel = { ...reference, occurrences: [] };
  return geography
    ? { ...model, countriesByTaxon: geography.countriesByTaxon }
    : model;
}

/** A `ReadApi` over the shared reference only (occurrences filled per stage). */
export function referenceApi(
  reference: ReferenceModel,
  geography?: GeographyIndex | null,
): ReadApi {
  return ReadApi.fromModel(referenceModel(reference, geography));
}

/**
 * Fetch the occurrences for one stage. Returns `[]` for a stage with no data
 * file (a sparse/empty stage → the existing empty state), and forwards the
 * abort signal so a superseded step can cancel this request.
 */
export async function fetchStageOccurrences(
  entry: AtlasStageEntry,
  signal?: AbortSignal,
): Promise<ReadOccurrence[]> {
  if (!entry.dataUrl) return [];
  const file = await fetchJson<StageFile>(entry.dataUrl, signal);
  return file.occurrences;
}

/** The stage-source the exploration view uses in partitioned (production) mode. */
export interface StageSource {
  index: AtlasIndex;
  loadStageOccurrences: (
    stage: GeologicalStage,
    signal?: AbortSignal,
  ) => Promise<ReadOccurrence[]>;
}

/** Build a {@link StageSource} from a boot result. */
export function stageSourceFromBoot(index: AtlasIndex): StageSource {
  const byName = new Map(index.stages.map((s) => [s.name, s]));
  return {
    index,
    loadStageOccurrences: (stage, signal) => {
      const entry = byName.get(stage.name);
      if (!entry) return Promise.resolve([]);
      return fetchStageOccurrences(entry, signal);
    },
  };
}

/** The most-populated stage per period (the quick-select target, REQ-003). */
export function representativeByPeriod(
  index: AtlasIndex,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of index.stages) {
    if (s.representative) out[s.period] = s.name;
  }
  return out;
}
