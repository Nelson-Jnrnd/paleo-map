/**
 * Shared UI test harness (SPEC-003 test plan). Builds the read model from the
 * committed SPEC-001 fixture and exposes loaders so scenario/component tests
 * drive the real app with no network. The MapLibre canvas does not initialise in
 * jsdom (no WebGL), so tests exercise the accessible occurrence path — the
 * equivalent, canvas-independent route the charter requires.
 */

import { buildReadModel } from "../../src/pipeline/build.js";
import { FixtureSourceClient } from "../../src/pipeline/fixture-client.js";
import { partitionReadModel } from "../../src/pipeline/partition.js";
import type { AtlasPartition } from "../../src/pipeline/partition.js";
import { applyWikipedia } from "../../src/pipeline/wikipedia.js";
import { ReadApi } from "../../src/read/api.js";
import type { ReadModel } from "../../src/domain/index.js";
import { DINOSAURIA_MESOZOIC } from "../../src/fixtures/dinosauria-mesozoic.js";

/**
 * SPEC-014 AMEND-005: give every fixture taxon a (synthetic) Wikipedia article so
 * the default Wikipedia gate hides nothing and the standard exploration loop is
 * unchanged. Tests that exercise the gate itself build their own mixed models.
 */
export function withFixtureWikipedia(model: ReadModel): ReadModel {
  return applyWikipedia(model, {
    resolvedOn: "2026-07-29",
    entries: Object.fromEntries(
      model.taxa.map((t) => [
        t.id,
        {
          title: t.scientificName,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.scientificName)}`,
        },
      ]),
    ),
  });
}

export async function fixtureModel(): Promise<ReadModel> {
  return withFixtureWikipedia(await buildReadModel(new FixtureSourceClient()));
}

export async function fixtureApi(): Promise<ReadApi> {
  return ReadApi.fromModel(await fixtureModel());
}

/** A full-Mesozoic (multi-period) model + API for SPEC-008 tests. */
export async function mesozoicModel(): Promise<ReadModel> {
  return withFixtureWikipedia(
    await buildReadModel(new FixtureSourceClient(DINOSAURIA_MESOZOIC)),
  );
}

export async function mesozoicApi(): Promise<ReadApi> {
  return ReadApi.fromModel(await mesozoicModel());
}

/** The stage-partitioned artifacts for the multi-period fixture. */
export async function mesozoicPartition(): Promise<AtlasPartition> {
  return partitionReadModel(await mesozoicModel());
}

/** A stable loader that resolves the fixture model (for <App loader={...}/>). */
export function fixtureLoader(): () => Promise<ReadModel> {
  return () => fixtureModel();
}

/** A loader that rejects, to drive the error state (FONC-1310). */
export function failingLoader(
  message = "network down",
): () => Promise<ReadModel> {
  return () => Promise.reject(new Error(message));
}
