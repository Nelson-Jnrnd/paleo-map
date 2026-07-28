/**
 * DATA-007 — Media licence compliance.
 * Acceptance: no image renders without a licence + credit; artistic images are
 * labelled artistic; an asset whose licence cannot be honoured is not shown.
 */
import { describe, expect, it } from 'vitest';
import { isShowable } from '../src/domain/index.js';
import type { ImageAsset } from '../src/domain/index.js';
import { buildFixtureModel } from './helpers.js';

describe('DATA-007: media licence compliance', () => {
  it('an image without a licence is not showable', () => {
    const noLicence: ImageAsset = { type: 'FossilPhoto', credit: 'x', licence: null, imageUrl: 'i', sourceUrl: 'u', sourceId: 's' };
    const ok: ImageAsset = { type: 'SkeletalMount', credit: 'x', licence: 'CC BY 2.0', imageUrl: 'i', sourceUrl: 'u', sourceId: 's' };
    expect(isShowable(noLicence)).toBe(false);
    expect(isShowable(ok)).toBe(true);
  });

  it('every shown image carries a licence, credit, and resolvable source', async () => {
    const model = await buildFixtureModel();
    for (const profile of model.profiles) {
      for (const img of profile.images) {
        expect(img.licence, profile.taxonId).toBeTruthy();
        expect(img.credit, profile.taxonId).toBeTruthy();
        expect(model.sources[img.sourceId]).toBeDefined();
      }
    }
  });

  it('drops the unlicensed image but keeps the licensed one', async () => {
    const model = await buildFixtureModel();
    const trex = model.profiles.find((p) => p.taxonId === 'txn:tyrannosaurus')!;
    // The fixture has two Tyrannosaurus images; only the licensed one survives.
    expect(trex.images).toHaveLength(1);
    expect(trex.images[0]!.type).toBe('ArtisticReconstruction');
    expect(trex.images[0]!.licence).toBe('CC BY-SA 4.0');
  });

  it('orders the gallery restoration-first, not by sourceUrl (SPEC-014 AMEND-001)', async () => {
    const model = await buildFixtureModel();
    const trike = model.profiles.find((p) => p.taxonId === 'txn:triceratops')!;
    // The restoration's sourceUrl sorts *after* the mount's, so a plain URL sort
    // would put the mount first; the life restoration must still lead.
    expect(trike.images.map((i) => i.type)).toEqual([
      'ArtisticReconstruction',
      'SkeletalMount',
    ]);
  });
});
