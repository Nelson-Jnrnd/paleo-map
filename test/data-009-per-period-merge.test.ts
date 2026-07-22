/**
 * SPEC-008 REQ-001 — full-Mesozoic ingestion via per-period queries, merged
 * deterministically. `mergeById` de-duplicates by id and stable-sorts, so a
 * taxon captured in two period queries appears once and the merged order is
 * independent of query order. A build over a multi-period subset yields
 * occurrences in all three periods.
 */
import { describe, expect, it } from 'vitest';
import { mergeById, buildReadModel, FixtureSourceClient } from '../src/pipeline/index.js';
import { stagesInRange } from '../src/domain/index.js';
import { DINOSAURIA_MESOZOIC } from '../src/fixtures/dinosauria-mesozoic.js';

describe('SPEC-008 REQ-001: per-period merge is deterministic', () => {
  it('de-duplicates by oid and stable-sorts regardless of input order', () => {
    const a = [{ oid: 'occ:3', v: 1 }, { oid: 'occ:1', v: 1 }];
    const b = [{ oid: 'occ:1', v: 2 }, { oid: 'occ:2', v: 2 }]; // occ:1 overlaps
    const merged = mergeById([...a, ...b]);
    expect(merged.map((r) => r.oid)).toEqual(['occ:1', 'occ:2', 'occ:3']);
    // First occurrence of a duplicated id wins (stable).
    expect(merged.find((r) => r.oid === 'occ:1')!.v).toBe(1);
  });

  it('merge is order-independent (byte-stable result)', () => {
    const records = [{ oid: 'b' }, { oid: 'a' }, { oid: 'c' }, { oid: 'a' }];
    expect(JSON.stringify(mergeById(records))).toBe(
      JSON.stringify(mergeById([...records].reverse())),
    );
  });

  it('a multi-period build covers Triassic, Jurassic and Cretaceous', async () => {
    const model = await buildReadModel(new FixtureSourceClient(DINOSAURIA_MESOZOIC));
    const periods = new Set<string>();
    for (const o of model.occurrences) {
      const r = o.timeRange.value;
      if (!r) continue;
      for (const s of stagesInRange(r.minMa, r.maxMa)) periods.add(s.period);
    }
    expect(periods).toEqual(new Set(['Triassic', 'Jurassic', 'Cretaceous']));
  });
});
