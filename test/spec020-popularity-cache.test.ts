/**
 * SPEC-020 REQ-001, DATA-001, SEC-001, NFR-002 — the popularity cache: its
 * shape, its null-not-zero rule, what it may contain, and how the shipped file
 * lands on the read model. No test here calls the Wikimedia API.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { ReadModel } from "../src/domain/index.js";
import {
  POPULARITY_SOURCE_ID,
  applyPopularity,
  isEmptyCache,
  parsePopularityCache,
} from "../src/pipeline/popularity.js";
import type { PopularityCache } from "../src/pipeline/popularity.js";

const cache = JSON.parse(
  readFileSync("popularity/pageviews.json", "utf8"),
) as PopularityCache;

const model = JSON.parse(
  readFileSync("public/data/reference.json", "utf8"),
) as ReadModel;

test("REQ-001: the committed cache carries its window and retrieval date", () => {
  const parsed = parsePopularityCache(cache);
  expect(parsed.window).toMatch(/^\d{4}-\d{2}\/\d{4}-\d{2}$/);
  expect(parsed.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Object.keys(parsed.entries).length).toBeGreaterThan(900);
});

test("SEC-001: the cache holds taxon ids, numbers and dates — nothing else", () => {
  expect(Object.keys(cache).sort()).toEqual(["entries", "retrievedOn", "window"]);
  for (const [taxonId, views] of Object.entries(cache.entries)) {
    expect(taxonId).toMatch(/^txn:\d+$/);
    expect(views === null || typeof views === "number").toBe(true);
  }
});

test("REQ-001: an unresolved article is null, never zero", () => {
  const values = Object.values(cache.entries);
  expect(values.some((v) => v === null)).toBe(true);
  expect(values.some((v) => v === 0)).toBe(false);
});

test("REQ-001: a malformed cache is rejected loudly rather than shipped", () => {
  expect(() => parsePopularityCache(null)).toThrow(/root must be an object/);
  expect(() => parsePopularityCache({ entries: {} })).toThrow(/window/);
  expect(() =>
    parsePopularityCache({ window: "w", retrievedOn: "nope", entries: {} }),
  ).toThrow(/retrievedOn/);
  expect(() =>
    parsePopularityCache({
      window: "w",
      retrievedOn: "2026-08-11",
      entries: { "txn:1": -5 },
    }),
  ).toThrow(/non-negative/);
  expect(() =>
    parsePopularityCache({
      window: "w",
      retrievedOn: "2026-08-11",
      entries: { "txn:1": "lots" },
    }),
  ).toThrow(/non-negative/);
});

test("DATA-001: provenance is recorded once on the metadata, not per profile", () => {
  const applied = applyPopularity(model, cache);
  expect(applied.metadata.popularity).toEqual({
    window: cache.window,
    retrievedOn: cache.retrievedOn,
    sourceId: POPULARITY_SOURCE_ID,
  });
  const ranked = applied.profiles.filter(
    (p) => typeof p.popularity === "number",
  );
  expect(ranked.length).toBeGreaterThan(900);
  // The figure itself is a bare number; nothing per-profile repeats the source.
  for (const p of ranked.slice(0, 20)) {
    expect(typeof p.popularity).toBe("number");
  }
});

test("DATA-001: a taxon with no figure carries no figure — and never a zero", () => {
  const applied = applyPopularity(model, cache);
  const unresolved = Object.entries(cache.entries)
    .filter(([, v]) => v === null)
    .map(([id]) => id);
  expect(unresolved.length).toBeGreaterThan(0);
  for (const id of unresolved) {
    const profile = applied.profiles.find((p) => p.taxonId === id);
    expect(profile?.popularity ?? null).toBeNull();
  }
});

test("REQ-008: an empty cache leaves the model's metadata untouched", () => {
  const empty: PopularityCache = {
    window: "",
    retrievedOn: "1970-01-01",
    entries: {},
  };
  expect(isEmptyCache(empty)).toBe(true);
  const applied = applyPopularity(model, empty);
  expect(applied.metadata.popularity).toBeUndefined();
  expect(
    applied.profiles.every((p) => typeof p.popularity !== "number"),
  ).toBe(true);
});

test("REQ-001: applying is pure — the input model is not mutated", () => {
  const before = JSON.stringify(model.metadata);
  applyPopularity(model, cache);
  expect(JSON.stringify(model.metadata)).toBe(before);
});

test("REQ-001: the shipped artifact already carries the applied figures", () => {
  // The build wires this in (gen_web_data), so the committed reference must
  // already be ranked — otherwise the track would silently be unavailable.
  expect(model.metadata.popularity?.sourceId).toBe(POPULARITY_SOURCE_ID);
  expect(
    model.profiles.filter((p) => typeof p.popularity === "number").length,
  ).toBeGreaterThan(900);
});
