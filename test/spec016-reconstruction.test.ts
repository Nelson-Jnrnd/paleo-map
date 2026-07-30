/**
 * SPEC-016: frame-consistent occurrence reconstruction. The pure application of
 * the committed reconstruction cache places each occurrence at the frame's age
 * (REQ-001), records that age in provenance (DATA-001), falls back to the source
 * position on a cache miss, and — via `partitionReadModel` — gives the same
 * collection a different position in different stages while leaving the empty-cache
 * build byte-identical to before (REQ-003/NFR-001 opt-in).
 */

import { describe, expect, it } from 'vitest';
import {
  applyFrameReconstruction,
  reconstructionKey,
} from '../src/pipeline/reconstruction.js';
import { partitionReadModel } from '../src/pipeline/partition.js';
import { buildReadModel } from '../src/pipeline/build.js';
import { FixtureSourceClient } from '../src/pipeline/fixture-client.js';
import type { ReadModel, ReadOccurrence } from '../src/domain/index.js';
import { deriveProvenanceView } from '../src/domain/index.js';

function occ(
  id: string,
  modern: { lng: number; lat: number },
  paleo: { palaeoLng: number; palaeoLat: number } | null,
): ReadOccurrence {
  return {
    id,
    taxonId: 'txn:x',
    taxonName: 'X',
    collectionId: 'col:1',
    collectionName: 'C',
    formation: null,
    member: null,
    modernPosition: {
      value: { ...modern, region: 'R' },
      sourceId: 'ref:1',
      editorial: false,
      provenance: deriveProvenanceView({ value: modern }),
    },
    paleoPosition: {
      value: paleo ? { ...paleo, rotationModel: 'scotese' } : null,
      sourceId: 'ref:1',
      editorial: false,
      provenance: deriveProvenanceView({ value: paleo }),
    },
    timeRange: {
      value: { minMa: 66, maxMa: 72 },
      sourceId: 'ref:1',
      editorial: false,
      provenance: deriveProvenanceView({ value: { minMa: 66, maxMa: 72 } }),
    },
  };
}

describe('applyFrameReconstruction (REQ-001, DATA-001)', () => {
  it('places the occurrence at the frame age and records that age', () => {
    const o = occ('occ:1', { lng: -106.8, lat: 47.1 }, { palaeoLng: -75.4, palaeoLat: 55.2 });
    const cache = { [reconstructionKey(-106.8, 47.1, 69.1)]: [-79.56, 54.13] as [number, number] };

    const out = applyFrameReconstruction([o], 69.1, cache)[0]!;
    expect(out.paleoPosition.value).toEqual({
      palaeoLng: -79.56,
      palaeoLat: 54.13,
      rotationModel: 'scotese',
      reconstructionAgeMa: 69.1,
    });
    // Provenance stays coherent (not missing) for the new value.
    expect(out.paleoPosition.provenance.missing).toBe(false);
  });

  it('is keyed on the frame age — a different frame yields a different point', () => {
    const o = occ('occ:1', { lng: -106.8, lat: 47.1 }, { palaeoLng: -75.4, palaeoLat: 55.2 });
    const cache = {
      [reconstructionKey(-106.8, 47.1, 69.1)]: [-79.56, 54.13] as [number, number],
      [reconstructionKey(-106.8, 47.1, 77.9)]: [-72.1, 52.0] as [number, number],
    };
    const maas = applyFrameReconstruction([o], 69.1, cache)[0]!.paleoPosition.value;
    const camp = applyFrameReconstruction([o], 77.9, cache)[0]!.paleoPosition.value;
    expect(maas).not.toEqual(camp);
    expect(maas?.reconstructionAgeMa).toBe(69.1);
    expect(camp?.reconstructionAgeMa).toBe(77.9);
  });

  it('falls back to the source position on a cache miss (no silent guess)', () => {
    const o = occ('occ:1', { lng: -106.8, lat: 47.1 }, { palaeoLng: -75.4, palaeoLat: 55.2 });
    const out = applyFrameReconstruction([o], 69.1, {})[0]!; // empty cache
    expect(out).toBe(o); // unchanged reference
    expect(out.paleoPosition.value?.reconstructionAgeMa).toBeUndefined();
  });

  it('leaves an occurrence without a modern position untouched', () => {
    const o = occ('occ:1', { lng: -106.8, lat: 47.1 }, null);
    // Blank the modern position to model an unplaceable record.
    const blank: ReadOccurrence = {
      ...o,
      modernPosition: { ...o.modernPosition, value: null },
    };
    const cache = { [reconstructionKey(-106.8, 47.1, 69.1)]: [-79.56, 54.13] as [number, number] };
    expect(applyFrameReconstruction([blank], 69.1, cache)[0]).toBe(blank);
  });
});

describe('partitionReadModel with reconstruction (REQ-001/NFR-001)', () => {
  it('empty cache is a no-op — occurrences keep their source position', async () => {
    const model: ReadModel = await buildReadModel(new FixtureSourceClient());
    const withEmpty = partitionReadModel(model, undefined, {});
    const withoutArg = partitionReadModel(model);
    expect(JSON.stringify(withEmpty)).toBe(JSON.stringify(withoutArg));
    for (const s of withEmpty.stages) {
      for (const o of s.occurrences) {
        expect(o.paleoPosition.value?.reconstructionAgeMa).toBeUndefined();
      }
    }
  });
});
