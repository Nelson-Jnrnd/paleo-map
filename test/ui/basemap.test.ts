// @vitest-environment jsdom
/**
 * SPEC-004 REQ-002/004 — basemap frame reconciliation and graceful loading.
 * `describeFrame` must disclose when the (schematic) basemap does not share the
 * occurrences' rotation model; `loadBasemap` must resolve to null on any failure
 * so the map degrades to the ocean/graticule instead of breaking.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { describeFrame, loadBasemap } from '../../src/app/data/basemap.js';
import type { BasemapMeta } from '../../src/app/data/basemap.js';

const schematicMeta: BasemapMeta = {
  name: 'Late Cretaceous (schematic)',
  source: 'Schematic, project-authored',
  rotationModel: 'schematic',
  targetAgeMa: 70,
  licence: 'CC0-1.0',
  note: 'Indicative only.',
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('discloses a frame mismatch between schematic coastlines and Scotese points', () => {
  const { matches, note } = describeFrame(schematicMeta, 'scotese');
  expect(matches).toBe(false);
  expect(note).toMatch(/schematic/i);
  expect(note).toMatch(/scotese/i);
  expect(note).toMatch(/indicative/i);
});

test('confirms a match when models agree (case-insensitive)', () => {
  const { matches, note } = describeFrame({ ...schematicMeta, rotationModel: 'Scotese' }, 'scotese');
  expect(matches).toBe(true);
  expect(note).toMatch(/same reconstruction/i);
});

test('loadBasemap returns the parsed basemap on success', async () => {
  const geojson = { type: 'FeatureCollection', features: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('.geojson') ? geojson : schematicMeta),
    })) as unknown as typeof fetch,
  );
  const result = await loadBasemap();
  expect(result?.meta.rotationModel).toBe('schematic');
  expect(result?.geojson.type).toBe('FeatureCollection');
});

test('loadBasemap degrades to null when a fetch fails (REQ-004)', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch,
  );
  expect(await loadBasemap()).toBeNull();
});

test('loadBasemap degrades to null when fetch throws', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch,
  );
  expect(await loadBasemap()).toBeNull();
});
