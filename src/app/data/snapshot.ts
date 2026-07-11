/**
 * Snapshot loading (SPEC-003 NFR-001; SPEC-002 REQ-001/006, SPEC-001 DATA-005).
 * The app reads a single prebuilt static JSON artifact via `fetch` and never
 * contacts PBDB/Wikipedia or any first-party API. The artifact is produced at
 * build time by scripts/gen_web_data.ts and served from `public/data/`.
 */

import { ReadApi } from '../../read/api.js';
import type { ReadModel } from '../../domain/index.js';

/** A pluggable loader so tests can inject a model without a network fetch. */
export type ModelLoader = () => Promise<ReadModel>;

/** Default artifact path, relative to the served app root. */
export const SNAPSHOT_URL = 'data/snapshot.json';

export async function fetchReadModel(url: string = SNAPSHOT_URL): Promise<ReadModel> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Snapshot load failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as ReadModel;
}

export function readApiFromModel(model: ReadModel): ReadApi {
  return ReadApi.fromModel(model);
}

/** Production loader: fetch the prebuilt artifact and build the read API. */
export async function loadReadApi(url: string = SNAPSHOT_URL): Promise<ReadApi> {
  return readApiFromModel(await fetchReadModel(url));
}
