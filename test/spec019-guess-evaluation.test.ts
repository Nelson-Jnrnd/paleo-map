/**
 * SPEC-019 REQ-003, REQ-004, REQ-014, NFR-002, DATA-001 — guess validation and
 * the classification feedback: the deepest shared clade and the branch it rules
 * out, with no depth, distance or percentage anywhere in the result.
 */

import { expect, test } from "vitest";
import {
  evaluateGuess,
  normalizeName,
  resolveGuess,
} from "../src/app/state/dailyGenus.js";
import type { GameTaxon } from "../src/app/state/dailyGenus.js";
import { FIXTURE_TAXA, fixtureGameData, fixtureModel } from "./spec019-fixture.js";

const data = fixtureGameData();

const genus = (name: string): GameTaxon => {
  const t = data.guessable.find((g) => g.scientificName === name);
  if (!t) throw new Error(`${name} is not guessable`);
  return t;
};

const evaluate = (guessName: string, answerName: string) =>
  evaluateGuess(genus(guessName), genus(answerName), data);

test("REQ-004: Velociraptor against Tyrannosaurus shares Coelurosauria", () => {
  const result = evaluate("Velociraptor", "Tyrannosaurus");
  expect(result.sharedName).toBe("Coelurosauria");
  expect(result.sharedRank).toBe("Clade");
  expect(result.ruledOutName).toBe("Maniraptora");
  expect(result.correct).toBe(false);
});

test("REQ-004: Triceratops against Tyrannosaurus shares only Dinosauria", () => {
  const result = evaluate("Triceratops", "Tyrannosaurus");
  expect(result.sharedName).toBe("Dinosauria");
  expect(result.ruledOutName).toBe("Ornithischia");
});

test("REQ-004: the ruled-out branch is the child of the shared clade", () => {
  expect(evaluate("Diplodocus", "Tyrannosaurus").ruledOutName).toBe("Saurischia");
  expect(evaluate("Gorgosaurus", "Tyrannosaurus").ruledOutName).toBe("Albertosaurinae");
});

test("REQ-004: a guess hanging directly off the root rules out itself", () => {
  const result = evaluate("Nyasasaurus", "Tyrannosaurus");
  expect(result.sharedName).toBe("Dinosauria");
  expect(result.ruledOutName).toBe("Nyasasaurus");
});

test("REQ-004: the correct guess ends with no branch ruled out", () => {
  const result = evaluate("Tyrannosaurus", "Tyrannosaurus");
  expect(result.correct).toBe(true);
  expect(result.ruledOutId).toBeNull();
});

test("REQ-004: nothing below the shared clade is named", () => {
  const result = evaluate("Triceratops", "Tyrannosaurus");
  const rendered = JSON.stringify({
    sharedName: result.sharedName,
    sharedRank: result.sharedRank,
    ruledOutName: result.ruledOutName,
    scientificName: result.scientificName,
    time: result.time,
  });
  for (const hidden of ["Tyrannosaurus", "Tyrannosaurinae", "Tyrannosauridae", "Coelurosauria"]) {
    expect(rendered).not.toContain(hidden);
  }
});

test("REQ-004: no distance, depth or percentage is reported", () => {
  const result = evaluate("Velociraptor", "Tyrannosaurus");
  // `sharedDepth` exists to order guesses and is documented as never rendered;
  // no other numeric field may appear on the result.
  const numeric = Object.entries(result).filter(([, v]) => typeof v === "number");
  expect(numeric.map(([k]) => k)).toEqual(["sharedDepth"]);
});

test("REQ-014: two genera that would meet above Dinosauria meet at Dinosauria", () => {
  // Nyasasaurus and Triceratops share only the root in this tree.
  expect(evaluate("Nyasasaurus", "Triceratops").sharedName).toBe("Dinosauria");
});

test("REQ-003: every valid non-avian genus in scope is guessable", () => {
  const names = data.guessable.map((t) => t.scientificName).sort();
  expect(names).toEqual([
    "Diplodocus",
    "Gorgosaurus",
    "Nyasasaurus",
    "Triceratops",
    "Tyrannosaurus",
    "Velociraptor",
  ]);
});

test("REQ-003: a clade or family name is rejected as not a genus", () => {
  const result = resolveGuess("Ornithischia", data, FIXTURE_TAXA, []);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.rejection.reason).toBe("not-a-genus");
  expect(result.rejection.taxonName).toBe("Ornithischia");
  expect(result.rejection.detail).toBe("clade");
});

test("REQ-003: a junior synonym is rejected, naming its recorded status", () => {
  const result = resolveGuess("Antrodemus", data, FIXTURE_TAXA, []);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.rejection.reason).toBe("not-valid");
  expect(result.rejection.detail).toBe("Synonymous");
});

test("REQ-003: a taxon outside Dinosauria is rejected as out of scope", () => {
  const result = resolveGuess("Smilodon", data, FIXTURE_TAXA, []);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.rejection.reason).toBe("out-of-scope");
  expect(result.rejection.taxonName).toBe("Smilodon");
});

test("REQ-003: an avian genus is out of scope for the game", () => {
  const result = resolveGuess("Archaeopteryx", data, FIXTURE_TAXA, []);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.rejection.reason).toBe("out-of-scope");
  expect(result.rejection.detail).toBe("an avian branch");
});

test("REQ-003: an unknown name says so, naming nothing", () => {
  const result = resolveGuess("Nothingsaurus", data, FIXTURE_TAXA, []);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.rejection.reason).toBe("unknown");
  expect(result.rejection.taxonName).toBeNull();
});

test("REQ-003: a repeat is rejected as already guessed", () => {
  const result = resolveGuess("Velociraptor", data, FIXTURE_TAXA, ["t:veloci"]);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.rejection.reason).toBe("already-guessed");
});

test("REQ-003: matching is case- and diacritic-insensitive", () => {
  expect(normalizeName("Velociráptor")).toBe("velociraptor");
  expect(resolveGuess("  vELOCIRÁPTOR ", data, FIXTURE_TAXA, []).ok).toBe(true);
});

test("DATA-001: the index is built from the model and does not mutate it", () => {
  const model = fixtureModel();
  const before = JSON.stringify(model);
  fixtureGameData();
  expect(JSON.stringify(model)).toBe(before);
});

test("NFR-002: evaluation is bounded work, not a scan per guess", () => {
  const answer = genus("Tyrannosaurus");
  const started = performance.now();
  for (let i = 0; i < 1000; i++) evaluateGuess(genus("Gorgosaurus"), answer, data);
  // 1,000 evaluations well inside the 50 ms single-guess budget.
  expect(performance.now() - started).toBeLessThan(50);
});
