/**
 * Offline, deterministic `SourceClient` backed by a bundled subset. This is the
 * verified ingestion path in this environment (network policy denies PBDB/
 * Wikidata; a live HTTP adapter would implement the same interface).
 */

import type { SourceClient, SourceSubset } from './sources.js';
import { DINOSAURIA_MAASTRICHTIAN } from '../fixtures/dinosauria-maastrichtian.js';

export class FixtureSourceClient implements SourceClient {
  constructor(private readonly subset: SourceSubset = DINOSAURIA_MAASTRICHTIAN) {}

  async fetchSubset(): Promise<SourceSubset> {
    return this.subset;
  }
}
