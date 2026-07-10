/**
 * DATA-005 — Three tiers, served from a dated snapshot.
 * Acceptance: no runtime egress to PBDB/Wikipedia; every snapshot carries a
 * `retrievedOn` date. The read API serves L2+L3 from our own store only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadApi } from '../src/read/api.js';
import { serializeSnapshot } from '../src/pipeline/index.js';
import { buildFixtureModel } from './helpers.js';

describe('DATA-005: snapshot only, no runtime upstream egress', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(() => {
      throw new Error('network egress is forbidden at runtime (DATA-005)');
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers every query from the loaded snapshot without any fetch', async () => {
    const model = await buildFixtureModel();
    const json = serializeSnapshot(model);
    const api = ReadApi.fromJSON(json);

    // Exercise the full read surface.
    api.metadata();
    api.listTaxa();
    api.getTaxon('txn:tyrannosaurus');
    api.getProfile('txn:tyrannosaurus');
    api.resolveSource('src:pbdb');
    api.listOccurrences({ stage: 'Maastrichtian' });
    api.listOccurrences({ period: 'Cretaceous', taxonId: 'txn:tyrannosaurus' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('every snapshot carries a retrievedOn date and pinned rotation model', async () => {
    const model = await buildFixtureModel();
    expect(model.metadata.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(model.metadata.rotationModel).toBe('scotese');
    expect(model.metadata.rotationModelVersion).toBeTruthy();
  });

  it('in-memory filtering narrows occurrences by stage', async () => {
    const model = await buildFixtureModel();
    const api = ReadApi.fromModel(model);
    const all = api.listOccurrences();
    const campanianOnly = api
      .listOccurrences({ stage: 'Campanian' })
      .map((o) => o.id);
    // Only the Campanian–Maastrichtian spanning locality overlaps the Campanian.
    expect(campanianOnly).toEqual(['occ:3']);
    expect(all.length).toBe(5);
  });
});
