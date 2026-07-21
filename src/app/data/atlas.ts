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
  ReferenceModel,
} from "../../pipeline/partition.js";
import { progressRatio } from "./snapshot.js";
import type { ProgressCallback } from "./snapshot.js";

export type { AtlasIndex, AtlasStageEntry, ReferenceModel };

/** Default boot index path, relative to the served app root. */
export const INDEX_URL = "data/index.json";

export interface AtlasBoot {
  index: AtlasIndex;
  reference: ReferenceModel;
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
 * Boot the atlas: fetch the index, then the shared reference (streamed). Both
 * are required before the exploration view can render.
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
  return { index, reference };
}

/** The reference as a full read model with an empty occurrence set. */
export function referenceModel(reference: ReferenceModel): ReadModel {
  return { ...reference, occurrences: [] };
}

/** A `ReadApi` over the shared reference only (occurrences filled per stage). */
export function referenceApi(reference: ReferenceModel): ReadApi {
  return ReadApi.fromModel(referenceModel(reference));
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
