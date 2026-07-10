import { FixtureSourceClient, buildReadModel } from '../src/pipeline/index.js';
import type { ReadModel } from '../src/domain/index.js';

/** Build the read model from the bundled Dinosauria/Maastrichtian subset. */
export async function buildFixtureModel(): Promise<ReadModel> {
  return buildReadModel(new FixtureSourceClient());
}
