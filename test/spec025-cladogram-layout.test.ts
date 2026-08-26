/**
 * SPEC-025 REQ-001 — the pure layout function.
 *
 * The whole width-and-collision strategy is "exactly one label per row", so this
 * is where that is guaranteed. It runs without a DOM: the geometry is decided
 * before anything is drawn, which is the property that makes the connectors and
 * the labels incapable of disagreeing.
 */
import { expect, test } from "vitest";
import { layoutCladogram } from "../src/app/state/cladogramLayout.js";
import type { RevealedTree } from "../src/app/state/dailyGenus.js";

const node = (
  id: string,
  name: string,
  ruledOut: { id: string; name: string; by: string }[] = [],
  frontier = false,
) => ({ id, name, rank: "Clade", frontier, reachedBy: null, ruledOut });

test("REQ-001: an empty trunk yields an empty layout — the function is total", () => {
  const layout = layoutCladogram({ trunk: [], unresolved: true });
  expect(layout.rows).toEqual([]);
});

test("REQ-001: every row is unique, consecutive, and holds exactly one label", () => {
  const tree: RevealedTree = {
    trunk: [
      node("d", "Dinosauria", [{ id: "o", name: "Ornithischia", by: "Triceratops" }]),
      node("s", "Saurischia", [{ id: "sa", name: "Sauropoda", by: "Diplodocus" }]),
      node("t", "Theropoda", [], true),
    ],
    unresolved: true,
  };
  const { rows } = layoutCladogram(tree);
  // 3 trunk + 2 cuts + 2 guesses.
  expect(rows).toHaveLength(7);
  expect(rows.map((r) => r.row)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  // One label per row is the invariant the whole layout rests on.
  expect(new Set(rows.map((r) => r.row)).size).toBe(rows.length);
});

test("REQ-001: order is root-first, each branch followed by the guess inside it", () => {
  const tree: RevealedTree = {
    trunk: [
      node("d", "Dinosauria", [{ id: "o", name: "Ornithischia", by: "Triceratops" }]),
      node("s", "Saurischia", [], true),
    ],
    unresolved: false,
  };
  const { rows } = layoutCladogram(tree);
  expect(rows.map((r) => [r.kind, r.name])).toEqual([
    ["node", "Dinosauria"],
    ["cut", "Ornithischia"],
    ["guess", "Triceratops"],
    ["node", "Saurischia"],
  ]);
});

test("REQ-001/REQ-003: a guess that IS the branch collapses to one row", () => {
  // The shipped edge case: when the guessed genus is a direct child of the
  // shared clade, `ruledOut` is the guess itself. One taxon, so one node.
  const tree: RevealedTree = {
    trunk: [
      node("d", "Dinosauria", [
        { id: "n", name: "Nyasasaurus", by: "Nyasasaurus" },
      ]),
    ],
    unresolved: true,
  };
  const { rows } = layoutCladogram(tree);
  expect(rows).toHaveLength(2);
  expect(rows[1]!.kind).toBe("cut");
  expect(rows[1]!.isOwnGuess).toBe(true);
  // The name is not printed twice.
  expect(rows.filter((r) => r.name === "Nyasasaurus")).toHaveLength(1);
});

test("REQ-001: cuts share one column and guesses the next, whatever the depth", () => {
  const tree: RevealedTree = {
    trunk: [
      node("d", "Dinosauria", [{ id: "o", name: "Ornithischia", by: "Triceratops" }]),
      node("s", "Saurischia", []),
      node("t", "Theropoda", [{ id: "c", name: "Ceratosauria", by: "Ceratosaurus" }], true),
    ],
    unresolved: false,
  };
  const layout = layoutCladogram(tree);
  const cuts = layout.rows.filter((r) => r.kind === "cut");
  const guesses = layout.rows.filter((r) => r.kind === "guess");
  // Both eliminations line up, even though they hang off different depths —
  // that is what makes them read as two columns rather than a ragged edge.
  expect(new Set(cuts.map((c) => c.depth))).toEqual(new Set([layout.tipDepth]));
  expect(new Set(guesses.map((g) => g.depth))).toEqual(
    new Set([layout.guessDepth]),
  );
  expect(layout.tipDepth).toBe(3); // maxTrunkDepth (2) + 1
  expect(layout.guessDepth).toBe(4);
});

test("REQ-004: the unresolved continuation is never emitted, however it is set", () => {
  for (const unresolved of [true, false]) {
    const { rows } = layoutCladogram({
      trunk: [node("d", "Dinosauria", [], true)],
      unresolved,
    });
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.kind !== "guess" || r.name !== "")).toBe(true);
  }
});

test("NFR-003: rows are bounded by trunk + 2 × eliminations", () => {
  const eliminations = 8;
  const tree: RevealedTree = {
    trunk: [
      node(
        "d",
        "Dinosauria",
        Array.from({ length: eliminations }, (_, i) => ({
          id: `c${i}`,
          name: `Clade${i}`,
          by: `Guess${i}`,
        })),
        true,
      ),
    ],
    unresolved: true,
  };
  const { rows } = layoutCladogram(tree);
  expect(rows.length).toBeLessThanOrEqual(1 + 2 * eliminations);
  expect(rows).toHaveLength(1 + 2 * eliminations);
});

test("REQ-002: a cut knows its trunk row and a guess knows its cut row", () => {
  // The connector layer draws from these alone — no measurement, so if the
  // links are wrong the picture is wrong, and this is where that shows.
  const tree: RevealedTree = {
    trunk: [
      node("d", "Dinosauria", []),
      node("s", "Saurischia", [{ id: "sa", name: "Sauropoda", by: "Diplodocus" }], true),
    ],
    unresolved: false,
  };
  const { rows } = layoutCladogram(tree);
  const cut = rows.find((r) => r.kind === "cut")!;
  const guess = rows.find((r) => r.kind === "guess")!;
  const trunkRow = rows.find((r) => r.name === "Saurischia")!;
  expect(cut.parentRow).toBe(trunkRow.row);
  expect(guess.cutRow).toBe(cut.row);
});
