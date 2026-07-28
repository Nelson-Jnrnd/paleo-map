/**
 * SPEC-014 REQ-002 — Engine B (batch) pure core. The batch runner is engine-
 * agnostic at the cache boundary: whatever the model replies, the parser must
 * yield a schema-clean record that passes the *same* `validateCacheEntry` as an
 * agent-authored file, or be rejected. These tests pin the parse/normalize/
 * envelope behaviour without any network or LLM.
 */

import { expect, test } from "vitest";
import {
  buildUserPrompt,
  normalizeRecord,
  parseRecordText,
  toCacheEntry,
  type ArticleBundle,
} from "../src/pipeline/enrich-batch.js";
import { validateCacheEntry } from "../src/pipeline/enrichment.js";

const bundle: ArticleBundle = {
  taxonId: "txn:12345",
  taxonName: "Velociraptor",
  article: "Velociraptor",
  url: "https://en.wikipedia.org/wiki/Velociraptor",
  revid: 987654321,
};

test("a clean model reply round-trips into a valid cache entry", () => {
  const reply = JSON.stringify({
    commonName: null,
    pronunciation: "veh-LOSS-ih-RAP-tor",
    nameMeaning: "swift seizer",
    oneLiner: "A small feathered dromaeosaurid of the Late Cretaceous.",
    description: "Velociraptor was a small dromaeosaurid theropod. It bore a sickle claw on each foot.",
    bodyLength: { value: 2, unit: "m", low: null, high: null, confidence: "estimated" },
    height: null,
    mass: { value: 15, unit: "kg", low: 10, high: 20, confidence: "estimated" },
    diet: "Carnivore",
    era: "Late Cretaceous (Campanian)",
    discovery: { year: 1924, who: "Osborn", where: "Mongolia" },
    notableFacts: [{ tag: "claw", text: "Bore an enlarged sickle claw on the second toe." }],
  });
  const entry = toCacheEntry(bundle, parseRecordText(reply), "2026-07-28");
  expect(entry.engine).toBe("batch");
  expect(entry.source.revid).toBe(987654321);
  const check = validateCacheEntry(entry);
  expect(check.ok).toBe(true);
});

test("parseRecordText tolerates a markdown fence and leading prose", () => {
  const reply =
    "Here is the record:\n```json\n" +
    '{ "oneLiner": "A ceratopsian.", "notableFacts": [] }' +
    "\n```";
  const rec = parseRecordText(reply);
  expect(rec.oneLiner).toBe("A ceratopsian.");
  // Missing fields are filled with null / [] so the record stays schema-clean.
  expect(rec.bodyLength).toBeNull();
  expect(rec.notableFacts).toEqual([]);
  expect(validateCacheEntry(toCacheEntry(bundle, rec)).ok).toBe(true);
});

test("normalizeRecord drops degenerate measurements and all-null discovery", () => {
  const rec = normalizeRecord({
    bodyLength: { unit: "m", confidence: "stated" }, // no numeric value → dropped
    mass: { value: 100, unit: "kg", confidence: "bogus" }, // bad confidence → 'estimated'
    discovery: { year: null, who: null, where: null }, // all null → null
    notableFacts: [
      { tag: "a", text: "one" },
      { tag: "b", text: "two" },
      { tag: "c", text: "three" },
      { tag: "d", text: "four" },
      { tag: "e", text: "five (over cap)" },
    ],
  });
  expect(rec.bodyLength).toBeNull();
  expect(rec.mass).toEqual({ value: 100, unit: "kg", low: null, high: null, confidence: "estimated" });
  expect(rec.discovery).toBeNull();
  expect(rec.notableFacts).toHaveLength(4); // REQ-001: at most 4
  expect(validateCacheEntry(toCacheEntry(bundle, rec)).ok).toBe(true);
});

test("parseRecordText throws when the reply has no JSON object", () => {
  expect(() => parseRecordText("I could not find that article.")).toThrow();
});

test("the extraction prompt carries the genus name and the article body", () => {
  const prompt = buildUserPrompt("Stegosaurus", "Stegosaurus was a plated dinosaur.");
  expect(prompt).toContain("Genus: Stegosaurus");
  expect(prompt).toContain("plated dinosaur");
  expect(prompt).toContain("notableFacts");
});
