/**
 * DATA-001 — Mandatory, structural provenance.
 * Acceptance: no occurrence, time range, or profile field can be serialized to
 * the app store without a resolvable source reference.
 */
import { describe, expect, it } from 'vitest';
import { validateReadModel } from '../src/pipeline/index.js';
import type { ReadModel } from '../src/domain/index.js';
import { buildFixtureModel } from './helpers.js';

describe('DATA-001: structural provenance', () => {
  it('the built snapshot has zero provenance violations', async () => {
    const model = await buildFixtureModel();
    expect(validateReadModel(model)).toEqual([]);
  });

  it('rejects a displayable value with no source and no editorial marker', async () => {
    const model = await buildFixtureModel();
    // Corrupt a *displayable* taxon validity (a genus with a winning opinion, not
    // an ancestor whose validity is null) to drop its source without marking it
    // editorial.
    const valued = model.taxa.find((t) => t.validity.value !== null)!;
    valued.validity.sourceId = null;
    valued.validity.editorial = false;
    const violations = validateReadModel(model);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.message).toMatch(/no source/);
  });

  it('rejects a displayable value whose source does not resolve', async () => {
    const model = await buildFixtureModel();
    model.occurrences[0]!.timeRange.sourceId = 'src:does-not-exist';
    const violations = validateReadModel(model);
    expect(violations.some((v) => /does not resolve/.test(v.message))).toBe(true);
  });

  it('allows an explicit null value as "not available" with no source', async () => {
    const model = await buildFixtureModel();
    // A null-valued measurement carries no source and must NOT be a violation.
    const empty: ReadModel = {
      ...model,
      taxa: [
        {
          ...model.taxa[0]!,
          validity: { value: null, sourceId: null, editorial: false, provenance: model.taxa[0]!.validity.provenance },
        },
      ],
    };
    expect(validateReadModel(empty)).toEqual([]);
  });
});
