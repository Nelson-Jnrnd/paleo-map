/**
 * Silhouette index — the committed contract for bundled PhyloPic silhouettes
 * (SPEC-014 REQ-004). `silhouettes/index.json` maps each taxonId to the local
 * path of its resolved silhouette SVG (already downloaded under
 * public/data/silhouettes/ by scripts/fetch_silhouettes.ts). The build only reads
 * this committed index and attaches the paths to profiles — no PhyloPic calls at
 * build or read time, so the snapshot stays offline and deterministic (NFR-001).
 */

import { readFile } from "node:fs/promises";
import type { ReadModel } from "../domain/snapshot.js";

export interface SilhouetteIndex {
  /** Local path to the Homo sapiens silhouette for the size-vs-human hero. */
  human: string | null;
  /** taxonId → local silhouette path. */
  taxa: Record<string, string>;
}

/** Load the committed silhouette index, or an empty one when absent. */
export async function loadSilhouetteIndex(
  path: string,
): Promise<SilhouetteIndex> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as SilhouetteIndex;
    return {
      human: parsed.human ?? null,
      taxa: parsed.taxa ?? {},
    };
  } catch {
    return { human: null, taxa: {} };
  }
}

/**
 * Attach silhouette paths to a read model's profiles by taxonId (SPEC-014
 * REQ-004). Pure: returns a new model with `profile.silhouette` set where the
 * index covers a taxon and left null otherwise.
 */
export function applySilhouettes(
  model: ReadModel,
  index: SilhouetteIndex,
): ReadModel {
  return {
    ...model,
    profiles: model.profiles.map((p) => {
      const path = index.taxa[p.taxonId];
      return path ? { ...p, silhouette: path } : p;
    }),
  };
}
