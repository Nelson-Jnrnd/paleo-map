/**
 * DATA-004 — Sources are PBDB + Wikipedia/Wikidata with a typed chain.
 * Acceptance: encyclopedic (Wikipedia) values render marked tertiary; PBDB
 * values resolve to their citing reference where present.
 */
import { describe, expect, it } from 'vitest';
import { buildFixtureModel } from './helpers.js';

describe('DATA-004: PBDB + Wikidata + Wikipedia join with typed source kinds', () => {
  it('joins matched taxa to encyclopedic content marked tertiary', async () => {
    const model = await buildFixtureModel();
    const trex = model.profiles.find((p) => p.taxonId === 'txn:tyrannosaurus')!;
    expect(trex.summary).not.toBeNull();
    expect(trex.summary!.provenance.interpretative).toBe(true);
    const src = model.sources[trex.summary!.sourceId!]!;
    expect(src.kind).toBe('Encyclopedic');
  });

  it('unmatched taxa degrade to no encyclopedic content (explicit not-available)', async () => {
    const model = await buildFixtureModel();
    const nano = model.profiles.find((p) => p.taxonId === 'txn:nanotyrannus')!;
    expect(nano.summary).toBeNull();
    expect(nano.commonName).toBeNull();
  });

  it('PBDB occurrence values resolve to their citing PrimaryLiterature reference', async () => {
    const model = await buildFixtureModel();
    const occ = model.occurrences[0]!;
    const src = model.sources[occ.timeRange.sourceId!]!;
    expect(src.kind).toBe('PrimaryLiterature');
    // The typed chain records it was obtained via the PBDB Database source.
    expect(src.derivedFrom).toBe('src:pbdb');
    expect(model.sources['src:pbdb']!.kind).toBe('Database');
    expect(occ.timeRange.provenance.interpretative).toBe(false);
  });

  it('editorial values chain back to the encyclopedic article they draw on', async () => {
    const model = await buildFixtureModel();
    const ed = model.sources['src:ed:txn:tyrannosaurus']!;
    expect(ed.kind).toBe('Editorial');
    expect(ed.derivedFrom).toBe('src:wp:Q14332');
    expect(model.sources[ed.derivedFrom!]!.kind).toBe('Encyclopedic');
  });
});
