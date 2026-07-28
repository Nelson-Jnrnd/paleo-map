/**
 * SPEC-014 REQ-002 — the enrichment cache is the contract. The schema validator
 * must accept a well-formed record and reject malformed ones regardless of which
 * engine wrote them, freshness is a revid match, and applying the cache attaches
 * records to profiles by taxonId (pure, deterministic).
 */

import { expect, test } from "vitest";
import {
  applyEnrichment,
  isFresh,
  validateCacheEntry,
  type EnrichmentCacheEntry,
} from "../src/pipeline/enrichment.js";
import type { EnrichmentRecord, ReadModel, ReadProfile } from "../src/domain/index.js";

const validRecord: EnrichmentRecord = {
  commonName: "tyrant lizard",
  pronunciation: "tie-RAN-oh-SORE-us",
  nameMeaning: "tyrant lizard",
  oneLiner: "A large predatory theropod of the latest Cretaceous.",
  description: "Tyrannosaurus was a large bipedal carnivore. It had a massive skull.",
  bodyLength: { value: 12.3, unit: "m", low: 11, high: 13, confidence: "estimated" },
  height: null,
  mass: { value: 8400, unit: "kg", low: 6000, high: 9000, confidence: "estimated" },
  diet: "Carnivore",
  era: "Late Cretaceous, ~68–66 Ma.",
  discovery: { year: 1905, who: "H. F. Osborn", where: "North America" },
  notableFacts: [
    { tag: "size", text: "Among the largest land predators known." },
    { tag: "bite", text: "Had one of the strongest bites of any land animal." },
  ],
};

function validEntry(): EnrichmentCacheEntry {
  return {
    taxonId: "txn:38613",
    taxonName: "Tyrannosaurus",
    source: {
      article: "Tyrannosaurus",
      url: "https://en.wikipedia.org/wiki/Tyrannosaurus",
      revid: 1234567,
    },
    engine: "agent",
    assertedOn: "2026-07-26",
    record: validRecord,
  };
}

test("accepts a well-formed cache entry", () => {
  const r = validateCacheEntry(validEntry());
  expect(r.ok).toBe(true);
});

test("rejects a bad envelope (missing revid, bad url, unknown engine)", () => {
  const bad = validEntry() as unknown as Record<string, unknown>;
  (bad.source as Record<string, unknown>).revid = "nope";
  (bad.source as Record<string, unknown>).url = "ftp://x";
  bad.engine = "wizard";
  const r = validateCacheEntry(bad);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors.some((e) => e.includes("revid"))).toBe(true);
    expect(r.errors.some((e) => e.includes("url"))).toBe(true);
    expect(r.errors.some((e) => e.includes("engine"))).toBe(true);
  }
});

test("rejects a malformed record (bad measurement, non-nullable string, bad fact)", () => {
  const bad = validEntry();
  // @ts-expect-error deliberately wrong shape
  bad.record.bodyLength = { value: "big", unit: "", low: 1, high: null, confidence: "guess" };
  // @ts-expect-error deliberately wrong shape
  bad.record.diet = 42;
  // @ts-expect-error deliberately wrong shape
  bad.record.notableFacts = [{ tag: "x" }];
  const r = validateCacheEntry(bad);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors.some((e) => e.includes("bodyLength.value"))).toBe(true);
    expect(r.errors.some((e) => e.includes("confidence"))).toBe(true);
    expect(r.errors.some((e) => e.includes("diet"))).toBe(true);
    expect(r.errors.some((e) => e.includes("notableFacts"))).toBe(true);
  }
});

test("null facts are valid (extract-don't-invent)", () => {
  const entry = validEntry();
  entry.record = {
    commonName: null, pronunciation: null, nameMeaning: null, oneLiner: null,
    description: null, bodyLength: null, height: null, mass: null, diet: null,
    era: null, discovery: null, notableFacts: [],
  };
  expect(validateCacheEntry(entry).ok).toBe(true);
});

test("freshness is a revid match", () => {
  const entry = validEntry();
  expect(isFresh(entry, 1234567)).toBe(true);
  expect(isFresh(entry, 9999999)).toBe(false);
});

test("applyEnrichment attaches records by taxonId, leaves others null", () => {
  const model = {
    profiles: [
      { taxonId: "txn:38613", enrichment: null } as unknown as ReadProfile,
      { taxonId: "txn:99999", enrichment: null } as unknown as ReadProfile,
    ],
  } as unknown as ReadModel;
  const cache = new Map([["txn:38613", validEntry()]]);
  const out = applyEnrichment(model, cache);
  expect(out.profiles[0]!.enrichment?.oneLiner).toContain("theropod");
  expect(out.profiles[1]!.enrichment).toBeNull();
  // Input model is not mutated (pure).
  expect(model.profiles[0]!.enrichment).toBeNull();
});
