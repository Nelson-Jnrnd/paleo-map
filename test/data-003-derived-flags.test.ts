/**
 * DATA-003 — Uncertainty flags are derived, not stored.
 * Acceptance: the flags follow the underlying data; there is no writable column
 * for them. Verified on the derivation functions and on the built model.
 */
import { describe, expect, it } from 'vitest';
import { deriveProvenanceView, spansMultipleStages } from '../src/domain/index.js';
import { buildFixtureModel } from './helpers.js';

describe('DATA-003: derived display flags', () => {
  it('interpretative follows the source kind', () => {
    expect(deriveProvenanceView({ value: 'x', sourceKind: 'Encyclopedic' }).interpretative).toBe(true);
    expect(deriveProvenanceView({ value: 'x', sourceKind: 'Editorial' }).interpretative).toBe(true);
    expect(deriveProvenanceView({ value: 'x', sourceKind: 'PrimaryLiterature' }).interpretative).toBe(false);
    expect(deriveProvenanceView({ value: 'x', sourceKind: 'Database' }).interpretative).toBe(false);
  });

  it('missing follows a null value — even for a numeric field', () => {
    expect(deriveProvenanceView({ value: null, sourceKind: 'Encyclopedic' }).missing).toBe(true);
    expect(deriveProvenanceView({ value: 8400, sourceKind: 'Encyclopedic' }).missing).toBe(false);
    // A tertiary numeric value is both interpretative and non-missing.
    const view = deriveProvenanceView({ value: 8400, sourceKind: 'Encyclopedic' });
    expect(view).toMatchObject({ interpretative: true, missing: false });
  });

  it('reconstructed follows paleocoordinate presence', () => {
    expect(deriveProvenanceView({ value: {}, sourceKind: 'Database', reconstructed: true }).reconstructed).toBe(true);
    expect(deriveProvenanceView({ value: {}, sourceKind: 'Database' }).reconstructed).toBe(false);
  });

  it('approximate follows stage spanning', () => {
    expect(spansMultipleStages(66.5, 68.0)).toBe(false); // Maastrichtian only
    expect(spansMultipleStages(70.0, 74.0)).toBe(true); // Campanian + Maastrichtian
    expect(deriveProvenanceView({ value: {}, sourceKind: 'PrimaryLiterature', approximate: spansMultipleStages(70, 74) }).approximate).toBe(true);
  });

  it('the built model flags follow the data', async () => {
    const model = await buildFixtureModel();
    const spanning = model.occurrences.find((o) => o.id === 'occ:3')!;
    expect(spanning.timeRange.provenance.approximate).toBe(true);
    expect(spanning.paleoPosition.provenance.reconstructed).toBe(true);

    const single = model.occurrences.find((o) => o.id === 'occ:1')!;
    expect(single.timeRange.provenance.approximate).toBe(false);

    const noPaleo = model.occurrences.find((o) => o.id === 'occ:5')!;
    expect(noPaleo.paleoPosition.provenance.missing).toBe(true);
    expect(noPaleo.paleoPosition.provenance.reconstructed).toBe(false);
    expect(noPaleo.paleoPosition.value).toBeNull();
  });

  it('re-deriving the view yields the same flags (computed, cannot drift)', async () => {
    const model = await buildFixtureModel();
    const occ = model.occurrences.find((o) => o.id === 'occ:3')!;
    const recomputed = deriveProvenanceView({
      value: occ.timeRange.value,
      sourceKind: 'PrimaryLiterature',
      approximate: spansMultipleStages(occ.timeRange.value!.minMa, occ.timeRange.value!.maxMa),
    });
    expect(recomputed.approximate).toBe(occ.timeRange.provenance.approximate);
  });
});
