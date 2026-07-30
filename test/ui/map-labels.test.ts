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
