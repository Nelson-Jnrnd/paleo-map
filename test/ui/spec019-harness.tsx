/**
 * Rendering harness for the Dinordle screen tests (SPEC-019). Builds a model
 * from the shared fixture, padded past `MIN_POOL_SIZE` so the screen takes the
 * real pool path rather than the degraded-pool error state, and finds a UTC date
 * whose *production* selection is the genus a test wants to play against — so
 * nothing here bypasses `selectDailyGenus`.
 */

import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import type {
  ReadModel,
  ReadProfile,
  ReadTaxon,
} from "../../src/domain/index.js";
import { ReadApi } from "../../src/read/api.js";
import { DailyGenusScreen } from "../../src/app/components/DailyGenusScreen.js";
import type { DailyGenusScreenProps } from "../../src/app/components/DailyGenusScreen.js";
import { buildTaxonomyIndex } from "../../src/app/state/taxonomy.js";
import {
  MIN_POOL_SIZE,
  buildGameData,
  selectDailyGenus,
  utcDateKey,
} from "../../src/app/state/dailyGenus.js";
import type { KeyValueStore } from "../../src/app/state/dailyGenusStorage.js";
import {
  FIXTURE_TAXA,
  fixtureProfiles,
  paddingTaxa,
} from "../spec019-fixture.js";
import type { ProfileOptions } from "../spec019-fixture.js";

export function paddedModel(options: ProfileOptions = {}): ReadModel {
  const padding = paddingTaxa(MIN_POOL_SIZE + 20);
  const taxa: ReadTaxon[] = [...FIXTURE_TAXA, ...padding];
  const baseProfiles = fixtureProfiles(options);
  const template = baseProfiles[0]!;
  const paddedProfiles: ReadProfile[] = padding.map(
    (t) => ({ ...template, taxonId: t.id }) as ReadProfile,
  );
  return {
    metadata: { retrievedOn: "2026-07-26" },
    taxa,
    profiles: [...baseProfiles, ...paddedProfiles],
    occurrences: [],
    sources: {},
  } as unknown as ReadModel;
}

export function harnessApi(options: ProfileOptions = {}): ReadApi {
  return ReadApi.fromModel(paddedModel(options));
}

/** The first UTC date at or after the epoch whose daily answer is `taxonId`. */
export function dateWithAnswer(api: ReadApi, taxonId: string): string {
  const profiles = new Map(
    api.listTaxa().map((t) => [t.id, api.getProfile(t.id)]),
  );
  const data = buildGameData(
    api.listTaxa(),
    buildTaxonomyIndex(api.listTaxa()),
    (id) => profiles.get(id),
  );
  const start = Date.parse("2026-08-11T00:00:00Z");
  for (let day = 0; day < data.pool.length + 2; day++) {
    const key = utcDateKey(new Date(start + day * 86_400_000));
    if (selectDailyGenus(key, data.pool) === taxonId) return key;
  }
  throw new Error(`no date selects ${taxonId}`);
}

/** A `now` that always reports noon on the given UTC date. */
export function clockOn(dateKey: string): () => Date {
  return () => new Date(`${dateKey}T12:00:00Z`);
}

export function memoryStore(): KeyValueStore & {
  readonly map: Map<string, string>;
} {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

export interface Harness extends RenderResult {
  readonly api: ReadApi;
  readonly onBack: ReturnType<typeof vi.fn>;
  readonly onOpenProfile: ReturnType<typeof vi.fn>;
  readonly store: KeyValueStore & { readonly map: Map<string, string> };
}

/** Render the screen playing against `answerName`, on a date that selects it. */
export function renderGame(
  answerName = "Tyrannosaurus",
  overrides: Partial<DailyGenusScreenProps> = {},
  options: ProfileOptions = {},
): Harness {
  const api = overrides.api ?? harnessApi(options);
  const answerId = api
    .listTaxa()
    .find((t) => t.scientificName === answerName)?.id;
  if (!answerId) throw new Error(`${answerName} is not in the fixture`);
  const onBack = vi.fn();
  const onOpenProfile = vi.fn();
  const store = memoryStore();
  const result = render(
    <DailyGenusScreen
      api={api}
      onOpenProfile={onOpenProfile}
      now={clockOn(dateWithAnswer(api, answerId))}
      random={() => 0}
      store={store}
      {...overrides}
    />,
  );
  return { ...result, api, onBack, onOpenProfile, store };
}
