/**
 * Shared UI test harness (SPEC-003 test plan). Builds the read model from the
 * committed SPEC-001 fixture and exposes loaders so scenario/component tests
 * drive the real app with no network. The MapLibre canvas does not initialise in
 * jsdom (no WebGL), so tests exercise the accessible occurrence path — the
 * equivalent, canvas-independent route the charter requires.
 */

import { buildReadModel } from '../../src/pipeline/build.js';
import { FixtureSourceClient } from '../../src/pipeline/fixture-client.js';
import { ReadApi } from '../../src/read/api.js';
import type { ReadModel } from '../../src/domain/index.js';

export async function fixtureModel(): Promise<ReadModel> {
  return buildReadModel(new FixtureSourceClient());
}

export async function fixtureApi(): Promise<ReadApi> {
  return ReadApi.fromModel(await fixtureModel());
}

/** A stable loader that resolves the fixture model (for <App loader={...}/>). */
export function fixtureLoader(): () => Promise<ReadModel> {
  return () => fixtureModel();
}

/** A loader that rejects, to drive the error state (FONC-1310). */
export function failingLoader(message = 'network down'): () => Promise<ReadModel> {
  return () => Promise.reject(new Error(message));
}
