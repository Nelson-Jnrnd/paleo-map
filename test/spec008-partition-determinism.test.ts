/**
 * SPEC-008 REQ-005 + NFR-002 — stage-partitioned delivery, deterministic. The
 * read model is split into a shared reference (no occurrences), per-stage
 * occurrence files, and an index; boundary-straddling occurrences appear in each
 * overlapped stage (keyed by id); rebuilds are byte-identical.
 */
import { describe, expect, it } from 'vitest';
import {
  buildReadModel,
  FixtureSourceClient,
  partitionReadModel,
  serializeCompact,
} from '../src/pipeline/index.js';
import { DINOSAURIA_MESOZOIC } from '../src/fixtures/dinosauria-mesozoic.js';

async function partition() {
  const model = await buildReadModel(new FixtureSourceClient(DINOSAURIA_MESOZOIC));
  return partitionReadModel(model);
}

describe('SPEC-008 REQ-005: stage-partitioned delivery', () => {
  it('factors reference data out of the per-stage files', async () => {
    const p = await partition();
    // Reference carries the shared data; occurrences are NOT duplicated into it.
    expect(Object.keys(p.reference).sort()).toEqual(
      ['metadata', 'profiles', 'sources', 'taxa'],
    );
    expect(p.reference).not.toHaveProperty('occurrences');
    expect(p.reference.taxa.length).toBe(4);
  });

  it('the index lists every stage with counts, bounds and a data URL when non-empty', async () => {
    const p = await partition();
    expect(p.index.stages.length).toBe(30);
    const norian = p.index.stages.find((s) => s.name === 'Norian')!;
    expect(norian.occurrenceCount).toBe(1);
    expect(norian.dataUrl).toBe('data/stage-norian.json');
    expect(norian.basemapUrl).toBe('basemap/norian.geojson');
    // An empty stage has no data file.
    const induan = p.index.stages.find((s) => s.name === 'Induan')!;
    expect(induan.occurrenceCount).toBe(0);
    expect(induan.dataUrl).toBeNull();
  });

  it('a boundary-straddling occurrence appears in each overlapped stage', async () => {
    const p = await partition();
    const inStage = (slug: string) =>
      p.stages.find((s) => s.slug === slug)?.occurrences.map((o) => o.id) ?? [];
    // occ:cre2 spans 74–70 Ma → Campanian and Maastrichtian.
    expect(inStage('campanian')).toContain('occ:cre2');
    expect(inStage('maastrichtian')).toContain('occ:cre2');
  });

  it('marks one representative (most-populated) stage per period', async () => {
    const p = await partition();
    const reps = p.index.stages.filter((s) => s.representative);
    expect(new Set(reps.map((s) => s.period))).toEqual(
      new Set(['Triassic', 'Jurassic', 'Cretaceous']),
    );
    // Cretaceous representative is Maastrichtian (2 occurrences vs Campanian's 1).
    expect(reps.find((s) => s.period === 'Cretaceous')!.name).toBe('Maastrichtian');
  });

  it('NFR-002: two partitions serialize byte-for-byte identically', async () => {
    const a = await partition();
    const b = await partition();
    expect(serializeCompact(a.index)).toBe(serializeCompact(b.index));
    expect(serializeCompact(a.reference)).toBe(serializeCompact(b.reference));
    for (let i = 0; i < a.stages.length; i++) {
      expect(serializeCompact(a.stages[i])).toBe(serializeCompact(b.stages[i]));
    }
  });
});
