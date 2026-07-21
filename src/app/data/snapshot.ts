/**
 * Snapshot loading (SPEC-003 NFR-001; SPEC-002 REQ-001/006, SPEC-001 DATA-005;
 * SPEC-006 UX-002/003). The app reads a single prebuilt static JSON artifact via
 * `fetch` and never contacts PBDB/Wikipedia or any first-party API. The artifact
 * is produced at build time by scripts/gen_web_data.ts and served from
 * `public/data/`. The loader streams the response so the boot UI can show real
 * download progress (SPEC-006 UX-002): determinate when a byte total is known,
 * indeterminate otherwise.
 */

import { ReadApi } from "../../read/api.js";
import type { ReadModel } from "../../domain/index.js";

/** Ordered startup phases surfaced to the loading UI (SPEC-006 UX-003). */
export type LoadPhase = "downloading" | "preparing" | "ready";

/** A progress report emitted during load. `ratio` is present only when a byte
 *  total is known (determinate); otherwise the UI shows an indeterminate state. */
export interface LoadProgress {
  phase: LoadPhase;
  receivedBytes?: number | undefined;
  totalBytes?: number | undefined;
  /** Clamped 0..1 when determinate; undefined when the total is unknown. */
  ratio?: number | undefined;
}

export type ProgressCallback = (progress: LoadProgress) => void;

/**
 * A pluggable loader so tests can inject a model without a network fetch. The
 * optional callback lets the boot UI reflect download progress; loaders that do
 * not report progress simply ignore it (SPEC-006 UX-002 indeterminate path).
 */
export type ModelLoader = (onProgress?: ProgressCallback) => Promise<ReadModel>;

/** Default artifact path, relative to the served app root. */
export const SNAPSHOT_URL = "data/snapshot.json";

/**
 * Fraction downloaded (SPEC-006 UX-002). Pure so it is unit-testable. Returns
 * `undefined` when the total is unknown/non-positive (→ indeterminate UI), and
 * clamps to [0,1] otherwise. Note: for a gzipped response the received
 * (decompressed) bytes can exceed the compressed Content-Length; clamping keeps
 * the bar sane and it simply pins at 100% for the tail.
 */
export function progressRatio(
  received: number,
  total: number | undefined,
): number | undefined {
  if (!total || total <= 0) return undefined;
  if (received <= 0) return 0;
  const r = received / total;
  return r > 1 ? 1 : r;
}

export async function fetchReadModel(
  url: string = SNAPSHOT_URL,
  onProgress?: ProgressCallback,
): Promise<ReadModel> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Snapshot load failed (${res.status} ${res.statusText})`);
  }

  const totalHeader = res.headers.get("Content-Length");
  const total = totalHeader ? Number(totalHeader) : undefined;

  // No streaming body (older runtimes / mocked responses): fall back to a
  // one-shot parse with a coarse indeterminate → preparing signal.
  if (!res.body || typeof res.body.getReader !== "function") {
    onProgress?.({ phase: "downloading", totalBytes: total });
    const model = (await res.json()) as ReadModel;
    onProgress?.({ phase: "preparing", totalBytes: total });
    return model;
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
  const text = new TextDecoder().decode(buffer);
  return JSON.parse(text) as ReadModel;
}

export function readApiFromModel(model: ReadModel): ReadApi {
  return ReadApi.fromModel(model);
}

/** Production loader: fetch the prebuilt artifact and build the read API. */
export async function loadReadApi(
  url: string = SNAPSHOT_URL,
  onProgress?: ProgressCallback,
): Promise<ReadApi> {
  return readApiFromModel(await fetchReadModel(url, onProgress));
}
