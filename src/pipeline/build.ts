/**
 * Build orchestration (SPEC-001 §9): source client → L1 → L2+L3 read model,
 * validated against DATA-001/DATA-007 before it can be serialized. The output is
 * a dated, immutable snapshot artifact (DATA-005, NFR-001).
 */

import type { ReadModel } from '../domain/index.js';
import type { SourceClient } from './sources.js';
import { ingest } from './ingest.js';
import { derive } from './derive.js';
import { assertValidReadModel } from './validate.js';

/** Ingest → derive → validate. Deterministic for a given source subset. */
export async function buildReadModel(client: SourceClient): Promise<ReadModel> {
  const subset = await client.fetchSubset();
  const l1 = ingest(subset);
  const model = derive(l1);
  assertValidReadModel(model);
  return model;
}

/** Canonical JSON with sorted object keys, so byte-equality is meaningful. */
export function serializeSnapshot(model: ReadModel): string {
  return JSON.stringify(model, sortedReplacer(), 2) + '\n';
}

/**
 * Compact (whitespace-free) variant of the canonical serializer for the web
 * artifact. Keys are still sorted, so it stays deterministic/byte-stable; it just
 * drops indentation (SPEC-003 AMEND-002: the served file needs no pretty-print —
 * ~37% smaller on disk; the wire is gzipped either way).
 */
export function serializeSnapshotCompact(model: ReadModel): string {
  return JSON.stringify(model, sortedReplacer()) + '\n';
}

function sortedReplacer(): (key: string, value: unknown) => unknown {
  return (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
    }
    return value;
  };
}
