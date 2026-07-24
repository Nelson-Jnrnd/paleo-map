/**
 * SPEC-011 REQ-003 — ingested Wikipedia summaries are normalised so a
 * pronunciation-only or empty leading parenthetical does not survive as a
 * dangling fragment, while well-formed parentheticals are left untouched.
 */

import { expect, test } from "vitest";
import { cleanSummary } from "../src/pipeline/ingest.js";

test("strips a dangling '(; ' leader but keeps the parenthetical", () => {
  expect(cleanSummary('Alamosaurus (; meaning "Ojo Alamo lizard").')).toBe(
    'Alamosaurus (meaning "Ojo Alamo lizard").',
  );
});

test("removes a parenthetical left entirely empty", () => {
  expect(cleanSummary("Foo (;) baz")).toBe("Foo baz");
  expect(cleanSummary("Foo () baz")).toBe("Foo baz");
});

test("leaves a well-formed parenthetical unchanged", () => {
  const withIpa = 'Alamosaurus (/ˌæləməˈsɔːrəs/; meaning "Ojo Alamo lizard")';
  expect(cleanSummary(withIpa)).toBe(withIpa);
  expect(cleanSummary("A sauropod (a long-necked dinosaur).")).toBe(
    "A sauropod (a long-necked dinosaur).",
  );
});

test("passes through null (explicit not-available)", () => {
  expect(cleanSummary(null)).toBeNull();
});
