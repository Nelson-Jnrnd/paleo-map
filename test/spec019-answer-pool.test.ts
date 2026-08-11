/**
 * SPEC-019 REQ-002, REQ-003, DATA-001 — the answer pool, checked against the
 * **shipped** artifact rather than a fixture: it is derived from the snapshot
 * alone, every entry clears the quality gate, and it is large enough to ship.
 *
 * No hand-authored list exists anywhere in the feature (owner decision,
 * 2026-08-08), so this test is also the guard against one creeping back in.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { ReadModel } from "../src/domain/index.js";
import { buildTaxonomyIndex } from "../src/app/state/taxonomy.js";
import { MIN_POOL_SIZE, buildGameData } from "../src/app/state/dailyGenus.js";

const model = JSON.parse(
  readFileSync("public/data/reference.json", "utf8"),
) as ReadModel;

const profiles = new Map(model.profiles.map((p) => [p.taxonId, p]));
const index = buildTaxonomyIndex(model.taxa);
const data = buildGameData(model.taxa, index, (id) => profiles.get(id));
const taxaById = new Map(model.taxa.map((t) => [t.id, t]));

test("REQ-002: the shipped pool is large enough to ship", () => {
  expect(data.pool.length).toBeGreaterThanOrEqual(MIN_POOL_SIZE);
});

test("REQ-002: every pool entry clears the whole quality gate", () => {
  for (const id of data.pool) {
    const taxon = taxaById.get(id)!;
    const profile = profiles.get(id)!;
    expect(taxon.rank).toBe("Genus");
    expect(taxon.validity.value).toBe("Valid");
    expect(index.inScope(id)).toBe(true);
    expect(index.isAvian(id)).toBe(false);
    expect(profile.silhouette).toBeTruthy();
    expect(profile.timeSpan).toBeTruthy();
    expect(profile.summary).toBeTruthy();
    expect(profile.images.length).toBeGreaterThan(0);
  }
});

test("REQ-002: the pool is a subset of the guessable set", () => {
  const guessable = new Set(data.guessable.map((t) => t.id));
  for (const id of data.pool) expect(guessable.has(id)).toBe(true);
});

test("REQ-002/DATA-001: re-deriving from the same model is byte-stable", () => {
  const again = buildGameData(model.taxa, buildTaxonomyIndex(model.taxa), (id) =>
    profiles.get(id),
  );
  expect(again.pool).toEqual(data.pool);
  expect(again.guessable.map((t) => t.id)).toEqual(data.guessable.map((t) => t.id));
});

test("REQ-003: the guessable set is the valid non-avian genera in scope", () => {
  const expected = model.taxa.filter(
    (t) =>
      t.rank === "Genus" &&
      t.validity.value === "Valid" &&
      index.inScope(t.id) &&
      !index.isAvian(t.id),
  );
  expect(data.guessable).toHaveLength(expected.length);
  // The measured figure the spec is sized against, so a snapshot that moves it
  // materially fails here rather than silently changing the game.
  expect(data.guessable.length).toBeGreaterThan(1_000);
});

test("REQ-002: the pool contains no avian, invalid, or out-of-scope taxon", () => {
  const rootName = model.taxa.find((t) => t.id === index.rootId)?.scientificName;
  expect(rootName).toBe("Dinosauria");
  for (const id of data.pool) {
    expect(index.avian.has(id)).toBe(false);
    expect(taxaById.get(id)!.validity.value).toBe("Valid");
  }
});
