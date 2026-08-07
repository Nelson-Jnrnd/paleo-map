// @vitest-environment jsdom
/**
 * SPEC-017 REQ-005 — clade fan geometry. Wedge angles proportional to the genera
 * a branch holds, children exactly filling their parent's arc, a bounded render
 * depth, and labels only where a wedge is wide enough to carry one.
 */

import { expect, test } from "vitest";
import type { ReadTaxon } from "../../src/domain/index.js";
import { buildTaxonomyIndex } from "../../src/app/state/taxonomy.js";
import {
  FAN_MAX_DEPTH,
  buildFan,
  ringRadii,
  wedgePath,
} from "../../src/app/components/cladeFan.js";
import {
  CLADE_MARKERS,
  FALLBACK_MARKER,
} from "../../src/app/components/mapCladeMarkers.js";

const taxon = (
  id: string,
  name: string,
  rank: string,
  parentId: string | null,
): ReadTaxon =>
  ({ id, scientificName: name, rank, parentId }) as unknown as ReadTaxon;

// Theropoda holds 3 genera, Ornithischia 1 — a deliberate 3:1 split.
const fixture: ReadTaxon[] = [
  taxon("t:dino", "Dinosauria", "Clade", null),
  taxon("t:thero", "Theropoda", "Clade", "t:dino"),
  taxon("t:orni", "Ornithischia", "Clade", "t:dino"),
  taxon("t:tyr", "Tyrannosauridae", "Family", "t:thero"),
  taxon("t:trex", "Tyrannosaurus", "Genus", "t:tyr"),
  taxon("t:albo", "Albertosaurus", "Genus", "t:tyr"),
  taxon("t:cer", "Ceratosaurus", "Genus", "t:thero"),
  taxon("t:trike", "Triceratops", "Genus", "t:orni"),
  // A branch holding no genera at all.
  taxon("t:empty", "Emptyclade", "Clade", "t:dino"),
  // An eggshell family hanging directly off Dinosauria: it has a genus, but no
  // major-group ancestor at all, so nothing can tint it.
  taxon("t:oo", "Dictyoolithidae", "Family", "t:dino"),
  taxon("t:oog", "Dictyoolithus", "Genus", "t:oo"),
];

const index = buildTaxonomyIndex(fixture);
const wedges = buildFan(index, "t:dino");
const at = (name: string) => wedges.find((w) => w.name === name)!;

const TAU = Math.PI * 2;

test("children exactly fill their parent's arc", () => {
  const top = wedges.filter((w) => w.depth === 1);
  const total = top.reduce((sum, w) => sum + (w.endAngle - w.startAngle), 0);
  expect(total).toBeCloseTo(TAU, 10);

  const theropoda = at("Theropoda");
  const kids = wedges.filter(
    (w) =>
      w.depth === 2 &&
      w.startAngle >= theropoda.startAngle - 1e-9 &&
      w.endAngle <= theropoda.endAngle + 1e-9,
  );
  const kidTotal = kids.reduce(
    (sum, w) => sum + (w.endAngle - w.startAngle),
    0,
  );
  expect(kidTotal).toBeCloseTo(theropoda.endAngle - theropoda.startAngle, 10);
});

test("wedge angle is proportional to the genera the branch holds", () => {
  const thero = at("Theropoda");
  const orni = at("Ornithischia");
  expect(thero.genera).toBe(3);
  expect(orni.genera).toBe(1);
  const ratio =
    (thero.endAngle - thero.startAngle) / (orni.endAngle - orni.startAngle);
  expect(ratio).toBeCloseTo(3, 10);
});

test("angle ordering matches genus-count ordering", () => {
  const top = wedges
    .filter((w) => w.depth === 1)
    .map((w) => ({ genera: w.genera, width: w.endAngle - w.startAngle }));
  const byGenera = [...top].sort((a, b) => b.genera - a.genera);
  const byWidth = [...top].sort((a, b) => b.width - a.width);
  expect(byGenera.map((w) => w.genera)).toEqual(byWidth.map((w) => w.genera));
});

test("a branch holding no genera is omitted rather than drawn at zero width", () => {
  expect(wedges.find((w) => w.name === "Emptyclade")).toBeUndefined();
  for (const w of wedges) expect(w.endAngle).toBeGreaterThan(w.startAngle);
});

test("rendering depth does not exceed the declared bound", () => {
  const deep = buildFan(index, "t:dino", { maxDepth: 2 });
  expect(Math.max(...deep.map((w) => w.depth))).toBeLessThanOrEqual(2);
  expect(Math.max(...wedges.map((w) => w.depth))).toBeLessThanOrEqual(
    FAN_MAX_DEPTH,
  );
});

test("labels appear only above the legibility threshold", () => {
  const narrow = buildFan(index, "t:dino", { minLabelAngle: 10 });
  expect(narrow.every((w) => !w.labelled)).toBe(true);

  // With no angular threshold, the first ring labels and the deeper rings do
  // not: a chain of nested clades shares an angular ray, so labelling every
  // depth would stack them on top of each other.
  const wide = buildFan(index, "t:dino", { minLabelAngle: 0 });
  expect(wide.filter((w) => w.depth === 1).every((w) => w.labelled)).toBe(true);
  expect(wide.filter((w) => w.depth > 1).some((w) => w.labelled)).toBe(false);
});

test("avian membership is carried through to the renderer", () => {
  const avianFixture = [
    ...fixture,
    taxon("t:aves", "Aves", "Clade", "t:thero"),
    taxon("t:bird", "Brodavis", "Genus", "t:aves"),
  ];
  const avianIndex = buildTaxonomyIndex(avianFixture);
  const avianWedges = buildFan(avianIndex, "t:dino");
  expect(avianWedges.find((w) => w.name === "Aves")?.avian).toBe(true);
  expect(avianWedges.find((w) => w.name === "Ornithischia")?.avian).toBe(false);
});

test("rings are ordered outward and never overlap", () => {
  const first = ringRadii(1, 3);
  const second = ringRadii(2, 3);
  expect(first.outer).toBeLessThanOrEqual(second.inner + 1e-9);
  expect(ringRadii(3, 3).outer).toBeCloseTo(1, 10);
});

test("a wedge path is a closed annulus segment", () => {
  const d = wedgePath(at("Theropoda"), 100, FAN_MAX_DEPTH);
  expect(d.startsWith("M ")).toBe(true);
  expect(d.endsWith("Z")).toBe(true);
  expect(d.match(/A /g)).toHaveLength(2);
  expect(d).not.toMatch(/NaN/);
});

test("AMEND-001: each wedge carries its clade's tint and the clade's name", () => {
  // The tint comes from the same resolver the map's markers use, so a clade is
  // the same hue on both screens.
  const thero = at("Theropoda");
  expect(thero.tint).toBe("#dc9a80");
  expect(thero.cladeLabel).toBe("Theropod");

  // Every wedge has a tint, and every tint is one of the declared clade tints —
  // no wedge invents a colour.
  const allowed = new Set(CLADE_MARKERS.map((m) => m.tint));
  for (const w of wedges) {
    expect(w.tint).toMatch(/^#[0-9a-f]{6}$/i);
    expect(allowed.has(w.tint)).toBe(true);
  }
});

test("AMEND-001: a branch with no resolvable major group takes the neutral fallback", () => {
  // An eggshell family with no major-group ancestor cannot be tinted, and must
  // not borrow a neighbouring clade's hue.
  expect(at("Dictyoolithidae").tint).toBe(FALLBACK_MARKER.tint);
});

test("SPEC-015 AMEND-003: the two great divisions carry their own tints", () => {
  // Before they were mapped, everything resolving only to Ornithischia or
  // Saurischia fell back to the neutral "Dinosaur" tint — 125 of the real fan's
  // 319 wedges. They are distinct from each other and from the fallback.
  const orni = at("Ornithischia");
  expect(orni.cladeLabel).toBe("Ornithischian");
  expect(orni.tint).not.toBe(FALLBACK_MARKER.tint);
});

test("AMEND-001: colour is never the only cue — name and clade are text", () => {
  for (const w of wedges) {
    expect(w.name.length).toBeGreaterThan(0);
    expect(w.cladeLabel.length).toBeGreaterThan(0);
  }
});

test("an out-of-scope or unknown root yields no fan, not a crash", () => {
  expect(buildFan(index, "t:missing")).toEqual([]);
  expect(buildFan(index, "t:dino", { maxDepth: 0 })).toEqual([]);
});
