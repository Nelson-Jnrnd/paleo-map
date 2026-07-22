/**
 * SPEC-008 AMEND-001 — a taxon profile reports the taxon's WHOLE-snapshot
 * occurrence total and time span, precomputed at build time, so a
 * stage-partitioned profile is not collapsed to the single loaded stage.
 */
import { describe, expect, it } from 'vitest';
import { buildFixtureModel } from './helpers.js';

describe('SPEC-008 AMEND-001: per-taxon occurrence aggregates', () => {
  it('aggregates count + full time span across all of a taxon’s occurrences', async () => {
    const model = await buildFixtureModel();
    const trex = model.profiles.find((p) => p.taxonId === 'txn:tyrannosaurus')!;
    // Two occurrences: occ:1 (Maastrichtian 68–66.5) and occ:3 (spanning 74–70).
    expect(trex.occurrenceCount).toBe(2);
    expect(trex.timeSpan).toEqual({ minMa: 66.5, maxMa: 74.0 });
    // occ:3 spans two stages → the taxon span is flagged approximate (DATA-003).
    expect(trex.timeSpanApproximate).toBe(true);
  });

  it('a single-stage taxon has a matching span and is not approximate', async () => {
    const model = await buildFixtureModel();
    const nano = model.profiles.find((p) => p.taxonId === 'txn:nanotyrannus')!;
    expect(nano.occurrenceCount).toBe(1);
    expect(nano.timeSpanApproximate).toBe(false);
  });
});
