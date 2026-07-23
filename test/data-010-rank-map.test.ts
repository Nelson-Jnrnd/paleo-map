/**
 * SPEC-010 DATA-003 — PBDB rank mapping. PBDB returns `rnk` as a name from some
 * endpoints and a numeric rank code from others; both must map to the domain rank.
 */
import { describe, expect, it } from 'vitest';
import { mapPbdbRank } from '../src/pipeline/http-client.js';

describe('mapPbdbRank: names and numeric codes', () => {
  it('maps rank names', () => {
    expect(mapPbdbRank('genus')).toBe('Genus');
    expect(mapPbdbRank('Family')).toBe('Family');
    expect(mapPbdbRank('species')).toBe('Species');
    expect(mapPbdbRank('unranked clade')).toBe('Clade');
    expect(mapPbdbRank('order')).toBe('Clade');
  });

  it('maps numeric PBDB rank codes (5 genus, 9 family, 3 species)', () => {
    expect(mapPbdbRank(5)).toBe('Genus');
    expect(mapPbdbRank(9)).toBe('Family');
    expect(mapPbdbRank(3)).toBe('Species');
    expect(mapPbdbRank(13)).toBe('Clade'); // order
    expect(mapPbdbRank(25)).toBe('Clade'); // unranked clade
  });

  it('defaults to Clade for unknown or missing', () => {
    expect(mapPbdbRank(undefined)).toBe('Clade');
    expect(mapPbdbRank('phylum')).toBe('Clade');
  });
});
