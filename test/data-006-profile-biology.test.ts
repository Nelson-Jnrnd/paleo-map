/**
 * DATA-006 — Taxon-profile biology is typed, nullable, sourced.
 * Acceptance: a numeric estimate never renders without a source or an
 * uncertainty range; an unpopulated field renders as an explicit "not
 * available"; ContentLevel is derived from how many fields are populated.
 */
import { describe, expect, it } from 'vitest';
import { deriveContentLevel } from '../src/domain/index.js';
import { buildFixtureModel } from './helpers.js';

describe('DATA-006: typed, nullable, sourced biology', () => {
  it('every populated numeric estimate has a resolvable source and bounds', async () => {
    const model = await buildFixtureModel();
    for (const profile of model.profiles) {
      for (const m of profile.measurements) {
        if (m.value.value === null) continue; // explicit "not available"
        expect(m.value.sourceId, `${profile.taxonId}/${m.kind}`).not.toBeNull();
        expect(model.sources[m.value.sourceId!]).toBeDefined();
        // Uncertainty is present as a range (never invented, but shown).
        expect(m.lowerBound).not.toBeNull();
        expect(m.upperBound).not.toBeNull();
      }
    }
  });

  it('an unpopulated measurement renders as explicit missing, not a fabricated value', async () => {
    const model = await buildFixtureModel();
    const tri = model.profiles.find((p) => p.taxonId === 'txn:triceratops')!;
    const mass = tri.measurements.find((m) => m.kind === 'BodyMass')!;
    expect(mass.value.value).toBeNull();
    expect(mass.value.provenance.missing).toBe(true);
  });

  it('derives the content-level ladder from populated fields', () => {
    expect(deriveContentLevel({ hasSummary: false, attributeCount: 0, measurementCount: 0, imageCount: 0, featured: false })).toBe('OccurrenceOnly');
    expect(deriveContentLevel({ hasSummary: true, attributeCount: 1, measurementCount: 0, imageCount: 0, featured: false })).toBe('ShortProfile');
    expect(deriveContentLevel({ hasSummary: true, attributeCount: 1, measurementCount: 1, imageCount: 1, featured: false })).toBe('DetailedProfile');
    expect(deriveContentLevel({ hasSummary: true, attributeCount: 2, measurementCount: 2, imageCount: 1, featured: true })).toBe('FeaturedSpecies');
  });

  it('the built profiles land on the expected content levels', async () => {
    const model = await buildFixtureModel();
    const level = (id: string) => model.profiles.find((p) => p.taxonId === id)!.contentLevel;
    expect(level('txn:tyrannosaurus')).toBe('FeaturedSpecies');
    expect(level('txn:triceratops')).toBe('DetailedProfile');
    expect(level('txn:nanotyrannus')).toBe('OccurrenceOnly');
  });
});
