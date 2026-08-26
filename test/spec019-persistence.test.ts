/**
 * SPEC-019 REQ-010, REQ-011, REQ-013, SEC-002 — persistence, the running
 * record, the spoiler-free summary, and the rules that keep practice rounds out
 * of both.
 */

import { expect, test } from "vitest";
import {
  EMPTY_RECORD,
  loadRecord,
  loadRound,
  recordRound,
  saveRecord,
  saveRound,
  shareSummary,
} from "../src/app/state/dailyGenusStorage.js";
import type { KeyValueStore } from "../src/app/state/dailyGenusStorage.js";
import {
  applyGuess,
  evaluateGuess,
  startRound,
  takeHint,
} from "../src/app/state/dailyGenus.js";
import type { GameTaxon, Round } from "../src/app/state/dailyGenus.js";
import { fixtureGameData } from "./spec019-fixture.js";

const data = fixtureGameData();
const genus = (name: string): GameTaxon => {
  const t = data.guessable.find((g) => g.scientificName === name);
  if (!t) throw new Error(`${name} is not guessable`);
  return t;
};

function memoryStore(): KeyValueStore & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

/** A store that refuses every write, like a full or blocked one. */
const hostileStore: KeyValueStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota exceeded");
  },
};

function play(answerName: string, guessNames: readonly string[], dateKey = "2026-08-11"): Round {
  const answer = genus(answerName);
  let round = startRound("daily", answer.id, dateKey);
  for (const name of guessNames) {
    round = applyGuess(round, evaluateGuess(genus(name), answer, data));
  }
  return round;
}

test("REQ-011: a saved round reloads with its guesses, hint and outcome", () => {
  const store = memoryStore();
  const round = takeHint(
    play("Tyrannosaurus", [
      "Triceratops",
      "Diplodocus",
      "Velociraptor",
      "Gorgosaurus",
      "Nyasasaurus",
    ]),
  );
  expect(saveRound(store, round)).toBe(true);

  const restored = loadRound(store, "2026-08-11")!;
  expect(restored.answerId).toBe(round.answerId);
  expect(restored.guesses.map((g) => g.scientificName)).toEqual([
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
  ]);
  expect(restored.hintUsed).toBe(true);
  expect(restored.outcome).toBe("playing");
});

test("REQ-011/REQ-013: state stored for another UTC date does not resume", () => {
  const store = memoryStore();
  saveRound(store, play("Tyrannosaurus", ["Triceratops"], "2026-08-10"));
  expect(loadRound(store, "2026-08-11")).toBeNull();
  expect(loadRound(store, "2026-08-10")).not.toBeNull();
});

test("REQ-010: a practice round is never persisted", () => {
  const store = memoryStore();
  const practice = applyGuess(
    startRound("practice", genus("Tyrannosaurus").id, null),
    evaluateGuess(genus("Triceratops"), genus("Tyrannosaurus"), data),
  );
  expect(saveRound(store, practice)).toBe(false);
  expect(store.map.size).toBe(0);
});

test("REQ-010: a practice round never touches the record", () => {
  const practice = applyGuess(
    startRound("practice", genus("Tyrannosaurus").id, null),
    evaluateGuess(genus("Tyrannosaurus"), genus("Tyrannosaurus"), data),
  );
  expect(recordRound(EMPTY_RECORD, practice)).toBe(EMPTY_RECORD);
});

test("SEC-002: the stored payload carries only ids, names, counts and dates", () => {
  const store = memoryStore();
  saveRound(store, play("Tyrannosaurus", ["Triceratops"]));
  const payload = JSON.parse([...store.map.values()][0]!) as Record<string, unknown>;
  expect(Object.keys(payload).sort()).toEqual([
    "answerId",
    "dateKey",
    "guesses",
    "hintUsed",
    "outcome",
  ]);
  const guess = (payload.guesses as Record<string, unknown>[])[0]!;
  expect(Object.keys(guess).sort()).toEqual(["scientificName", "taxonId"]);
});

test("Error handling: a blocked store leaves the game playable", () => {
  expect(loadRound(hostileStore, "2026-08-11")).toBeNull();
  expect(saveRound(hostileStore, play("Tyrannosaurus", ["Triceratops"]))).toBe(false);
  expect(loadRecord(hostileStore)).toEqual(EMPTY_RECORD);
  expect(saveRecord(hostileStore, EMPTY_RECORD)).toBe(false);
});

test("Error handling: an absent store and malformed JSON both read as no state", () => {
  expect(loadRound(null, "2026-08-11")).toBeNull();
  expect(loadRecord(null)).toEqual(EMPTY_RECORD);
  const store = memoryStore();
  store.map.set("paleo-map:daily-genus:round", "{not json");
  expect(loadRound(store, "2026-08-11")).toBeNull();
});

test("REQ-011: the record counts wins and keeps a streak across consecutive days", () => {
  let record = EMPTY_RECORD;
  record = recordRound(record, play("Tyrannosaurus", ["Tyrannosaurus"], "2026-08-11"));
  record = recordRound(record, play("Tyrannosaurus", ["Triceratops", "Tyrannosaurus"], "2026-08-12"));
  expect(record.played).toBe(2);
  expect(record.won).toBe(2);
  expect(record.streak).toBe(2);
  expect(record.bestStreak).toBe(2);
  expect(record.distribution).toEqual({ "1": 1, "2": 1 });
});

test("REQ-011: a skipped day restarts the streak, and a loss ends it", () => {
  let record = recordRound(EMPTY_RECORD, play("Tyrannosaurus", ["Tyrannosaurus"], "2026-08-11"));
  record = recordRound(record, play("Tyrannosaurus", ["Tyrannosaurus"], "2026-08-14"));
  expect(record.streak).toBe(1);
  expect(record.bestStreak).toBe(1);

  const lost = play("Tyrannosaurus", [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
  ], "2026-08-15");
  record = recordRound(record, lost);
  expect(record.streak).toBe(0);
  expect(record.played).toBe(3);
});

test("REQ-011: the same date is never counted twice", () => {
  const round = play("Tyrannosaurus", ["Tyrannosaurus"], "2026-08-11");
  const once = recordRound(EMPTY_RECORD, round);
  expect(recordRound(once, round)).toBe(once);
});

test("REQ-011: an unfinished round does not enter the record", () => {
  expect(recordRound(EMPTY_RECORD, play("Tyrannosaurus", ["Triceratops"]))).toBe(
    EMPTY_RECORD,
  );
});

test("REQ-011/REQ-004: the shared summary names no taxon and reports no distance", () => {
  // The hint is taken mid-round, at five misses, then the sixth guess wins.
  const hinted = takeHint(
    play("Tyrannosaurus", [
      "Triceratops",
      "Diplodocus",
      "Velociraptor",
      "Gorgosaurus",
      "Nyasasaurus",
    ]),
  );
  const round = applyGuess(
    hinted,
    evaluateGuess(genus("Tyrannosaurus"), genus("Tyrannosaurus"), data),
  );
  // ▲ marks a guess that pushed the tree deeper: Triceratops reaches
  // Dinosauria, Velociraptor Coelurosauria, Gorgosaurus Tyrannosauridae, and
  // the winning guess the answer itself.
  const summary = shareSummary(round);
  expect(summary).toBe("Dinordle 1 · 6/8 · hint · ▲·▲▲·▲");

  const forbidden = [
    ...data.guessable.map((t) => t.scientificName),
    "Dinosauria",
    "Theropoda",
    "Coelurosauria",
    "Tyrannosauridae",
    "Clade",
    "Family",
    // "Genus" is deliberately not in this list: it is the game's own name, not
    // a disclosed rank. The exact-equality assertion above covers the wording.
  ];
  for (const name of forbidden) expect(summary).not.toContain(name);
  // No number beyond the puzzle number and the guess count.
  expect(summary.match(/\d+/g)).toEqual(["1", "6", "8"]);
});

test("REQ-011: a lost round shares as X of eight", () => {
  const lost = play("Tyrannosaurus", [
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
    "Gorgosaurus",
    "Nyasasaurus",
    "Triceratops",
    "Diplodocus",
    "Velociraptor",
  ]);
  expect(shareSummary(lost)).toContain("X/8");
});
