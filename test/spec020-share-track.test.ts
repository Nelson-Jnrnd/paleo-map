/**
 * SPEC-020 REQ-006 — the shared summary names its track, and stays as
 * spoiler-free as SPEC-019 REQ-011 requires.
 */

import { expect, test } from "vitest";
import { shareSummary } from "../src/app/state/dailyGenusStorage.js";
import {
  applyGuess,
  evaluateGuess,
  startRound,
} from "../src/app/state/dailyGenus.js";
import type { GameTaxon, Round, Track } from "../src/app/state/dailyGenus.js";
import { fixtureGameData } from "./spec019-fixture.js";

const data = fixtureGameData();
const genus = (name: string): GameTaxon => {
  const t = data.guessable.find((g) => g.scientificName === name);
  if (!t) throw new Error(`${name} is not guessable`);
  return t;
};

function play(track: Track, guessNames: readonly string[]): Round {
  const answer = genus("Tyrannosaurus");
  let round = startRound("daily", answer.id, "2026-08-11", track);
  for (const name of guessNames) {
    round = applyGuess(round, evaluateGuess(genus(name), answer, data));
  }
  return round;
}

test("REQ-006: the full track's summary is unchanged from SPEC-019", () => {
  const round = play("full", ["Triceratops", "Tyrannosaurus"]);
  expect(shareSummary(round)).toBe("Daily Genus 1 · 2/8 · ▲▲");
});

test("REQ-006: the well-known track names itself", () => {
  const round = play("wellKnown", ["Triceratops", "Tyrannosaurus"]);
  expect(shareSummary(round)).toBe("Daily Genus 1 · well-known · 2/8 · ▲▲");
});

test("REQ-006: naming the track leaks nothing about the answer", () => {
  const summary = shareSummary(play("wellKnown", ["Velociraptor", "Diplodocus"]));
  const forbidden = [
    ...data.guessable.map((t) => t.scientificName),
    "Dinosauria",
    "Theropoda",
    "Coelurosauria",
    "Tyrannosauridae",
    "Clade",
    "Family",
  ];
  for (const name of forbidden) expect(summary).not.toContain(name);
  // Unfinished, so the score reads X/8: the puzzle number and the budget are
  // the only digits.
  expect(summary).toContain("X/8");
  expect(summary.match(/\d+/g)).toEqual(["1", "8"]);
});

test("REQ-006: two tracks are distinguishable at a glance in a shared result", () => {
  const full = shareSummary(play("full", ["Tyrannosaurus"]));
  const known = shareSummary(play("wellKnown", ["Tyrannosaurus"]));
  expect(full).not.toBe(known);
  expect(known).toContain("well-known");
  expect(full).not.toContain("well-known");
});
