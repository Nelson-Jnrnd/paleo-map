/**
 * Resolve a source id to its human citation for display (FONC-930/1100,
 * PERF-140). Every visible occurrence/value carries an identifiable source; we
 * show the reference string, falling back to the raw id if unresolved so a
 * source is never silently dropped.
 */

import type { ReadApi } from '../read/api.js';

export function sourceReference(api: ReadApi, sourceId: string | null): string {
  if (!sourceId) return 'Unsourced';
  const source = api.resolveSource(sourceId);
  return source ? source.reference : sourceId;
}
