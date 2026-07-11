/**
 * NFR-001 — Import date and reproducibility.
 * Acceptance: two builds of L2 from one L1 snapshot are byte-stable for derived
 * fields.
 */
import { describe, expect, it } from 'vitest';
import { FixtureSourceClient, buildReadModel, serializeSnapshot } from '../src/pipeline/index.js';

describe('NFR-001: deterministic L2 rebuild', () => {
  it('two builds from the same subset serialize byte-for-byte identically', async () => {
    const a = serializeSnapshot(await buildReadModel(new FixtureSourceClient()));
    const b = serializeSnapshot(await buildReadModel(new FixtureSourceClient()));
    expect(a).toBe(b);
  });

  it('the import date comes from the snapshot, not the wall clock', async () => {
    const model = await buildReadModel(new FixtureSourceClient());
    // Fixed capture date — a rebuild tomorrow yields the same retrievedOn.
    expect(model.metadata.retrievedOn).toBe('2026-07-01');
  });

  it('derived ordering is stable (arrays sorted by a stable key)', async () => {
    const model = await buildReadModel(new FixtureSourceClient());
    const ids = model.taxa.map((t) => t.id);
    expect(ids).toEqual([...ids].sort());
  });
});
