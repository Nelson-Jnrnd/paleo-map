/**
 * SPEC-019 REQ-005, REQ-007, REQ-008, REQ-014 — the revealed tree: what the
 * guesses establish, what they eliminate, what must never appear (a sibling the
 * player has not touched), and how a round terminates.
 */

import { expect, test } from "vitest";
import {
  MAX_GUESSES,
  applyGuess,
  evaluateGuess,
  revealedTree,
  startRound,
} from "../src/app/state/dailyGenus.js";
import type { GameTaxon, Round } from "../src/app/state/dailyGenus.js";
import { fixtureGameData } from "./spec019-fixture.js";

const data = fixtureGameData();

const genus = (name: string): GameTaxon => {
  const t = data.guessable.find((g) => g.scientificName === name);
  if (!t) throw new Error(`${name} is not guessable`);
  return t;
};

/** Play a sequence of guesses against an answer. */
function play(answerName: string, guessNames: readonly string[]): Round {
  const answer = genus(answerName);
  let round = startRound("daily", answer.id, "2026-08-11");
  for (const name of guessNames) {
    round = applyGuess(round, evaluateGuess(genus(name), answer, data));
  }
  return round;
}

const trunkNames = (round: Round): string[] =>
  revealedTree(round, data).trunk.map((n) => n.name);

test("REQ-005: a fresh round shows the root and nothing else", () => {
  const tree = revealedTree(play("Tyrannosaurus", []), data);
  expect(tree.trunk.map((n) => n.name)).toEqual(["Dinosauria"]);
  expect(tree.unresolved).toBe(true);
});

test("REQ-005: a Dinosauria-level guess rules out exactly one child of the root", () => {
  const tree = revealedTree(play("Tyrannosaurus", ["Triceratops"]), data);
  expect(tree.trunk).toHaveLength(1);
  expect(tree.trunk[0]!.ruledOut).toEqual([
    { id: "t:orni", name: "Ornithischia", by: "Triceratops" },
  ]);
});

test("REQ-005: a deeper guess establishes every node down to the shared clade", () => {
  expect(trunkNames(play("Tyrannosaurus", ["Triceratops", "Velociraptor"]))).toEqual([
    "Dinosauria",
    "Theropoda",
    "Coelurosauria",
  ]);
});

test("REQ-005: a later shallower guess never retracts an established node", () => {
  const deepFirst = play("Tyrannosaurus", ["Velociraptor", "Triceratops"]);
  expect(trunkNames(deepFirst)).toEqual(["Dinosauria", "Theropoda", "Coelurosauria"]);
  const tree = revealedTree(deepFirst, data);
  // The shallow guess still contributes its elimination, at the root.
  expect(tree.trunk[0]!.ruledOut.map((r) => r.name)).toEqual(["Ornithischia"]);
});

test("REQ-005: eliminations accumulate across guesses at their own nodes", () => {
  const round = play("Tyrannosaurus", [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
  ]);
  const tree = revealedTree(round, data);
  expect(tree.trunk.map((n) => n.name)).toEqual([
    "Dinosauria",
    "Theropoda",
    "Coelurosauria",
    "Tyrannosauridae",
  ]);
  expect(tree.trunk[0]!.ruledOut.map((r) => r.name)).toEqual([
    "Ornithischia",
    "Saurischia",
  ]);
  expect(tree.trunk[2]!.ruledOut.map((r) => r.name)).toEqual(["Maniraptora"]);
  expect(tree.trunk[3]!.ruledOut.map((r) => r.name)).toEqual(["Albertosaurinae"]);
});

test("REQ-005: two guesses in the same branch produce one elimination", () => {
  // Both Tyrannosaurus and Gorgosaurus sit inside Theropoda; against a
  // Triceratops answer each guess rules out the same branch.
  const round = play("Triceratops", ["Tyrannosaurus", "Gorgosaurus"]);
  const tree = revealedTree(round, data);
  expect(tree.trunk[0]!.ruledOut).toHaveLength(1);
  expect(tree.trunk[0]!.ruledOut[0]!.name).toBe("Theropoda");
});

test("REQ-005: the deepest established node is the frontier, and names its guess", () => {
  const tree = revealedTree(play("Tyrannosaurus", ["Triceratops", "Gorgosaurus"]), data);
  const frontier = tree.trunk.filter((n) => n.frontier);
  expect(frontier).toHaveLength(1);
  expect(frontier[0]!.name).toBe("Tyrannosauridae");
  expect(frontier[0]!.reachedBy).toBe("Gorgosaurus");
});

test("REQ-005: only nodes a guess has touched are rendered — no siblings", () => {
  const tree = revealedTree(play("Tyrannosaurus", ["Velociraptor"]), data);
  const names = [
    ...tree.trunk.map((n) => n.name),
    ...tree.trunk.flatMap((n) => n.ruledOut.map((r) => r.name)),
  ];
  // Sibling branches of the established trunk that no guess has touched.
  for (const untouched of ["Saurischia", "Ornithischia", "Avialae", "Nyasasaurus"]) {
    expect(names).not.toContain(untouched);
  }
});

test("REQ-005/REQ-004: the answer is never named before the round ends", () => {
  const round = play("Tyrannosaurus", ["Triceratops", "Velociraptor", "Gorgosaurus"]);
  expect(round.outcome).toBe("playing");
  const rendered = JSON.stringify(revealedTree(round, data));
  expect(rendered).not.toContain("Tyrannosaurus\"");
  expect(rendered).not.toContain("Tyrannosaurinae");
});

test("REQ-014: every rendered chain begins at Dinosauria", () => {
  for (const answer of ["Tyrannosaurus", "Triceratops", "Nyasasaurus"]) {
    const tree = revealedTree(play(answer, ["Velociraptor", "Diplodocus"]), data);
    expect(tree.trunk[0]!.name).toBe("Dinosauria");
    expect(tree.trunk.map((n) => n.name)).not.toContain("Archosauria");
  }
});

test("REQ-007: a correct guess wins and completes the descent to the answer", () => {
  const round = play("Tyrannosaurus", ["Triceratops", "Tyrannosaurus"]);
  expect(round.outcome).toBe("won");
  const tree = revealedTree(round, data);
  expect(tree.unresolved).toBe(false);
  expect(tree.trunk.map((n) => n.name)).toEqual([
    "Dinosauria",
    "Theropoda",
    "Coelurosauria",
    "Tyrannosauridae",
    "Tyrannosaurinae",
    "Tyrannosaurus",
  ]);
});

test("REQ-007: the round is lost after eight misses and takes no ninth guess", () => {
  const misses = [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
  ];
  const round = play("Tyrannosaurus", misses);
  expect(round.guesses).toHaveLength(MAX_GUESSES);
  expect(round.outcome).toBe("lost");
  const after = applyGuess(
    round,
    evaluateGuess(genus("Tyrannosaurus"), genus("Tyrannosaurus"), data),
  );
  expect(after.guesses).toHaveLength(MAX_GUESSES);
  expect(after.outcome).toBe("lost");
});

/*
 * REQ-008's silhouette-hint test is gone with the requirement: SPEC-028 REQ-005
 * retires the hint. Measured reason, on record in that spec: 1,731 valid genera
 * resolve to only 403 distinct silhouettes, so for 86% of them the hint showed a
 * relative's outline rather than the animal's. The behaviour it covered no
 * longer exists — this is not a skipped or disabled test.
 */
