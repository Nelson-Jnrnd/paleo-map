/**
 * SPEC-019 REQ-006 — the time clue: older, younger or overlapping, decided from
 * the two spans, with an explicit "not available" instead of a blank or a
 * negative when either side has no span.
 */

import { expect, test } from "vitest";
import { evaluateGuess, timeVerdict } from "../src/app/state/dailyGenus.js";
import type { GameTaxon } from "../src/app/state/dailyGenus.js";
import { fixtureGameData } from "./spec019-fixture.js";

const data = fixtureGameData({ noSpan: ["t:gorgo"] });

const genus = (name: string): GameTaxon => {
  const t = data.guessable.find((g) => g.scientificName === name);
  if (!t) throw new Error(`${name} is not guessable`);
  return t;
};

const span = (maxMa: number, minMa: number) => ({ maxMa, minMa });

test("REQ-006: an answer wholly older than the guess reads older", () => {
  expect(timeVerdict(span(83.6, 66), span(157.9, 143.1))).toBe("older");
});

test("REQ-006: an answer wholly younger than the guess reads younger", () => {
  expect(timeVerdict(span(157.9, 143.1), span(83.6, 66))).toBe("younger");
});

test("REQ-006: intersecting spans read as overlapping", () => {
  expect(timeVerdict(span(100.5, 66), span(83.6, 66))).toBe("overlaps");
  expect(timeVerdict(span(83.6, 66), span(83.6, 66))).toBe("overlaps");
});

test("REQ-006: spans that touch at a bound overlap — a shared boundary is real", () => {
  expect(timeVerdict(span(100, 83.6), span(83.6, 66))).toBe("overlaps");
});

test("REQ-006: a missing span on either side is stated, never guessed", () => {
  expect(timeVerdict(null, span(83.6, 66))).toBe("unavailable");
  expect(timeVerdict(span(83.6, 66), null)).toBe("unavailable");
  expect(timeVerdict(null, null)).toBe("unavailable");
});

test("REQ-006: the verdict travels with the guess", () => {
  expect(evaluateGuess(genus("Diplodocus"), genus("Tyrannosaurus"), data).time).toBe(
    "younger",
  );
  expect(evaluateGuess(genus("Triceratops"), genus("Tyrannosaurus"), data).time).toBe(
    "overlaps",
  );
  expect(evaluateGuess(genus("Tyrannosaurus"), genus("Nyasasaurus"), data).time).toBe(
    "older",
  );
});

test("REQ-006: a guess with no time span does not break the round", () => {
  const result = evaluateGuess(genus("Gorgosaurus"), genus("Tyrannosaurus"), data);
  expect(result.time).toBe("unavailable");
  // The classification feedback is unaffected by the missing span.
  expect(result.sharedName).toBe("Tyrannosauridae");
});
