/**
 * SPEC-015 REQ-002 — label collision culling. Greedy placement keeps
 * non-overlapping labels and drops the rest, capped at a maximum. Pure and
 * map-free (projection + zoom gating live in OccurrenceMap).
 */

import { expect, test } from "vitest";
import { computeMapLabels } from "../../src/app/components/mapLabels.js";
import type { LabelCandidate } from "../../src/app/components/mapLabels.js";

const c = (id: string, x: number, y: number): LabelCandidate => ({
  id,
  taxon: "Tyrannosaurus",
  x,
  y,
});

test("drops labels whose boxes overlap an already-placed one", () => {
  // Two candidates at nearly the same spot: only the first survives.
  const out = computeMapLabels([c("a", 100, 100), c("b", 102, 101)]);
  expect(out.map((l) => l.id)).toEqual(["a"]);
});

test("keeps labels that are far enough apart", () => {
  const out = computeMapLabels([c("a", 100, 100), c("b", 100, 400)]);
  expect(out.map((l) => l.id)).toEqual(["a", "b"]);
});

test("respects the maxLabels cap in candidate order", () => {
  const many = Array.from({ length: 10 }, (_, i) => c(`p${i}`, 0, i * 200));
  const out = computeMapLabels(many, { maxLabels: 3 });
  expect(out.map((l) => l.id)).toEqual(["p0", "p1", "p2"]);
});

/* SPEC-017 REQ-008 — focused markers get the labels first. */

test("focused candidates take the cap ahead of unfocused ones", () => {
  // Ten well-separated candidates, cap of 3, and the focused one is last in
  // candidate order — previously it would never be named.
  const many = Array.from({ length: 10 }, (_, i) => c(`p${i}`, 0, i * 200));
  const focused = { ...c("focused", 0, 2000), focused: true };
  const out = computeMapLabels([...many, focused], { maxLabels: 3 });
  expect(out[0]?.id).toBe("focused");
  expect(out).toHaveLength(3);
});

test("ordering is unchanged when nothing is focused", () => {
  const many = Array.from({ length: 4 }, (_, i) => c(`p${i}`, 0, i * 200));
  expect(computeMapLabels(many).map((l) => l.id)).toEqual([
    "p0",
    "p1",
    "p2",
    "p3",
  ]);
});

test("collision culling still applies among focused candidates", () => {
  const a = { ...c("a", 100, 100), focused: true };
  const b = { ...c("b", 102, 101), focused: true };
  expect(computeMapLabels([a, b]).map((l) => l.id)).toEqual(["a"]);
});
