/**
 * DATA-002 — Validity and biology are sourced assertions.
 * Acceptance: a taxon's validity renders as `status + "per <source>"`; changing
 * the winning opinion changes the displayed status.
 */
import { describe, expect, it } from 'vitest';
import { acceptedOpinion } from '../src/domain/index.js';
import type { TaxonomicOpinion } from '../src/domain/index.js';
import { buildFixtureModel } from './helpers.js';

describe('DATA-002: validity is a sourced, derived assertion', () => {
  it('derives the winning opinion (most recently published)', () => {
    const opinions: TaxonomicOpinion[] = [
      { status: 'Valid', publishedOn: '1988-01-01', sourceId: 'ref:bakker1988' },
      { status: 'Synonymous', publishedOn: '2020-01-01', sourceId: 'ref:carr2020' },
    ];
    const accepted = acceptedOpinion(opinions);
    expect(accepted?.status).toBe('Synonymous');
    expect(accepted?.opinion.sourceId).toBe('ref:carr2020');
  });

  it('changing the winning opinion changes the derived status', () => {
    const base: TaxonomicOpinion[] = [
      { status: 'Valid', publishedOn: '1988-01-01', sourceId: 'ref:bakker1988' },
    ];
    expect(acceptedOpinion(base)?.status).toBe('Valid');
    const withNewer: TaxonomicOpinion[] = [
      ...base,
      { status: 'Doubtful', publishedOn: '2024-01-01', sourceId: 'ref:new' },
    ];
    expect(acceptedOpinion(withNewer)?.status).toBe('Doubtful');
  });

  it('renders validity as status + "per <source>" in the read model', async () => {
    const model = await buildFixtureModel();
    const nano = model.taxa.find((t) => t.id === 'txn:nanotyrannus')!;
    expect(nano.validity.value).toBe('Synonymous');
    expect(nano.validity.sourceId).toBe('ref:carr2020');
    expect(nano.acceptedPer).toMatch(/Carr, T\.D\. 2020/);
    // The source resolves — "per whom, and when" is answerable.
    expect(model.sources[nano.validity.sourceId!]).toBeDefined();
  });
});
