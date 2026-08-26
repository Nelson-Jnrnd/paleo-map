/**
 * SPEC-025 REQ-001/REQ-002, NFR-002 — the two layers agree about a row's x.
 *
 * The layout hands every row a `(row, depth)` pair, and both layers spend it:
 * the label layer through `rowStyle`'s `left`, the connector layer through
 * `cx`. The defect this guards against is spending it in only one of them — the
 * labels were pinned at the trunk's origin regardless of depth, so the leads
 * were drawn straight through the text. Like the layout itself, this is
 * arithmetic on integers, so it needs no browser (NFR-002).
 */
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { cx, rowStyle } from "../src/app/components/DailyGenusScreen.js";
import { layoutCladogram } from "../src/app/state/cladogramLayout.js";
import type { RevealedTree } from "../src/app/state/dailyGenus.js";

/**
 * The dot's diameter, read from the sheet rather than restated here — the
 * alignment is between the dot's *centre* and the connector, so a change to the
 * dot's size must fail this test rather than pass it against a stale copy.
 */
const DOT_PX = (() => {
  const css = readFileSync(
    new URL("../src/app/components/dailyGenus.module.css", import.meta.url),
    "utf8",
  );
  const match = /\.dot\s*\{[^}]*?width:\s*([\d.]+)px/.exec(css);
  if (!match) throw new Error("could not read .dot's width from the sheet");
  return Number(match[1]);
})();

const px = (value: string | undefined): number => {
  expect(value).toMatch(/^-?[\d.]+px$/);
  return Number.parseFloat(value!);
};

/** Where the dot at the head of a row lands, given the style the row is given. */
const dotCentre = (place: { row: number; depth: number }): number =>
  px(rowStyle(place).left) + DOT_PX / 2;

test("REQ-002: a row's dot centres on the connector column at every depth", () => {
  for (const depth of [0, 1, 2, 3, 4, 5, 9]) {
    // Half a pixel is the most the dot's centre may sit off the stroke: the dot
    // has an odd diameter, so its centre cannot land on an integer.
    expect(
      Math.abs(dotCentre({ row: 0, depth }) - cx(depth)),
    ).toBeLessThanOrEqual(0.5);
  }
});

test("REQ-001: labels indent — a deeper row starts further right", () => {
  const lefts = [0, 1, 2, 3].map((depth) =>
    px(rowStyle({ row: 0, depth }).left),
  );
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  expect(new Set(lefts).size).toBe(lefts.length);
  // One indent step is the same everywhere, so the columns are a grid.
  const steps = lefts.slice(1).map((l, i) => l - lefts[i]!);
  expect(new Set(steps).size).toBe(1);
});

test("REQ-002: every row of a real layout aligns, and rows keep one pitch", () => {
  const tree: RevealedTree = {
    trunk: [
      {
        id: "d",
        name: "Dinosauria",
        rank: "Clade",
        frontier: false,
        reachedBy: null,
        ruledOut: [{ id: "o", name: "Ornithischia", by: "Triceratops" }],
      },
      {
        id: "s",
        name: "Saurischia",
        rank: "Clade",
        frontier: false,
        reachedBy: null,
        ruledOut: [{ id: "sa", name: "Sauropoda", by: "Diplodocus" }],
      },
      {
        id: "t",
        name: "Theropoda",
        rank: "Clade",
        frontier: true,
        reachedBy: "Velociraptor",
        ruledOut: [],
      },
    ],
    unresolved: true,
  };
  const { rows } = layoutCladogram(tree);
  expect(rows.length).toBeGreaterThan(3);

  const tops: number[] = [];
  for (const row of rows) {
    expect(Math.abs(dotCentre(row) - cx(row.depth))).toBeLessThanOrEqual(0.5);
    tops.push(px(rowStyle(row).top));
  }
  // Consecutive rows are exactly one pitch apart — the same invariant the
  // connector layer's `cy` assumes.
  const pitches = tops.slice(1).map((t, i) => t - tops[i]!);
  expect(new Set(pitches).size).toBe(1);
  expect(pitches[0]).toBeGreaterThan(0);
});
