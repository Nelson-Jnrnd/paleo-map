/**
 * SPEC-008 REQ-002 — the full ICS Mesozoic stage table. The timeline steps every
 * Mesozoic stage; `stagesInRange` / `spansMultipleStages` operate over the whole
 * table, so the `approximate` cue is variable (not ~100% true).
 */
import { describe, expect, it } from 'vitest';
import {
  MESOZOIC_PERIODS,
  MESOZOIC_STAGES,
  stagesInPeriod,
  stagesInRange,
  spansMultipleStages,
  stageSlug,
} from '../src/domain/index.js';

describe('SPEC-008 REQ-002: full ICS Mesozoic stage table', () => {
  it('covers the whole Mesozoic, oldest → youngest, with ~30 stages', () => {
    expect(MESOZOIC_STAGES.length).toBe(30);
    expect(MESOZOIC_STAGES[0]!.name).toBe('Induan');
    expect(MESOZOIC_STAGES.at(-1)!.name).toBe('Maastrichtian');
    // Oldest bound is ~252 Ma, youngest is 66 Ma (the K–Pg boundary).
    expect(MESOZOIC_STAGES[0]!.startMa).toBeCloseTo(251.9, 1);
    expect(MESOZOIC_STAGES.at(-1)!.endMa).toBe(66.0);
  });

  it('is monotonic and contiguous (each stage abuts the next)', () => {
    for (let i = 0; i < MESOZOIC_STAGES.length; i++) {
      const s = MESOZOIC_STAGES[i]!;
      expect(s.startMa).toBeGreaterThan(s.endMa);
      if (i > 0) {
        // Younger bound of the older stage equals older bound of the next.
        expect(MESOZOIC_STAGES[i - 1]!.endMa).toBeCloseTo(s.startMa, 5);
      }
    }
  });

  it('groups every stage under one of the three periods', () => {
    expect(MESOZOIC_PERIODS).toEqual(['Triassic', 'Jurassic', 'Cretaceous']);
    const counts = MESOZOIC_PERIODS.map((p) => stagesInPeriod(p).length);
    expect(counts).toEqual([7, 11, 12]);
    for (const s of MESOZOIC_STAGES) {
      expect(MESOZOIC_PERIODS).toContain(s.period);
    }
  });

  it('overlap filtering picks stages across all periods, not just the Late Cretaceous', () => {
    expect(stagesInRange(215, 220).map((s) => s.name)).toEqual(['Norian']);
    expect(stagesInRange(150, 153).map((s) => s.name)).toEqual(['Kimmeridgian']);
    expect(stagesInRange(67, 70).map((s) => s.name)).toEqual(['Maastrichtian']);
  });

  it('the "spans multiple stages" cue is variable against the full table', () => {
    expect(spansMultipleStages(70, 71)).toBe(false); // Maastrichtian only
    expect(spansMultipleStages(70, 74)).toBe(true); // Campanian + Maastrichtian
    expect(spansMultipleStages(215, 220)).toBe(false); // Norian only
  });

  it('slugs are URL-safe and unique', () => {
    const slugs = MESOZOIC_STAGES.map((s) => stageSlug(s.name));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});
