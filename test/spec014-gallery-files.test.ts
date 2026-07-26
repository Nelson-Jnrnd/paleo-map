/**
 * SPEC-014 REQ-003 / AMEND-001 — gallery candidate files are normalised, deduped
 * per taxon, classified into semantic roles, then slotted (one restoration + one
 * fossil, in that order). All pure and deterministic.
 */

import { expect, test } from "vitest";
import {
  capFilesPerQid,
  classifyRole,
  normalizeCommonsTitle,
  selectGallerySlots,
  type GalleryCandidate,
} from "../src/pipeline/http-client.js";
import type { RawImageAsset } from "../src/pipeline/sources.js";

test("dedups by file title per taxon and preserves first-seen order", () => {
  const files = [
    { qid: "Q1", file: "P18.jpg" }, // P18 first
    { qid: "Q1", file: "pageimage.jpg" },
    { qid: "Q1", file: "P18.jpg" }, // duplicate → dropped
    { qid: "Q1", file: "cat1.jpg" },
    { qid: "Q2", file: "other.jpg" },
  ];
  const out = capFilesPerQid(files, 6);
  expect(out.map((f) => f.file)).toEqual([
    "P18.jpg",
    "pageimage.jpg",
    "cat1.jpg",
    "other.jpg",
  ]);
});

test("caps each taxon independently", () => {
  const files = Array.from({ length: 10 }, (_, i) => ({
    qid: "Q1",
    file: `f${i}.jpg`,
  }));
  files.push({ qid: "Q2", file: "z.jpg" });
  const out = capFilesPerQid(files, 3);
  expect(out.filter((f) => f.qid === "Q1")).toHaveLength(3);
  expect(out.filter((f) => f.qid === "Q2")).toHaveLength(1);
});

test("normalizeCommonsTitle collapses space/underscore + first-letter case (AMEND-001)", () => {
  // The real duplicate-image bug: P18 gives spaces, the category listing gives
  // underscores; both must normalise to the same title so the dedupe catches it.
  const p18 = normalizeCommonsTitle("Tyrannosaurus Rex Holotype.jpg");
  const cat = normalizeCommonsTitle("Tyrannosaurus_Rex_Holotype.jpg");
  expect(p18).toBe(cat);
  expect(normalizeCommonsTitle("File:foo_bar.png")).toBe("Foo bar.png");
  const files = [
    { qid: "Q1", file: normalizeCommonsTitle("Foo Bar.jpg") },
    { qid: "Q1", file: normalizeCommonsTitle("Foo_Bar.jpg") },
  ];
  expect(capFilesPerQid(files, 6)).toHaveLength(1);
});

test("classifyRole buckets by category/filename and excludes off-topic (AMEND-001)", () => {
  const base = { categories: "", description: "", isLead: false };
  expect(
    classifyRole({ ...base, file: "Tyrannosaurus skeleton AMNH.jpg" }),
  ).toBe("FossilPhoto");
  expect(
    classifyRole({
      ...base,
      file: "Trex.jpg",
      categories: "Life restorations of Tyrannosaurus",
    }),
  ).toBe("ArtisticReconstruction");
  // A lead image (P18 / pageimage) with no strong signal defaults to a
  // reconstruction — for extinct taxa the lead is almost always life art.
  expect(classifyRole({ ...base, file: "Trex.jpg", isLead: true })).toBe(
    "ArtisticReconstruction",
  );
  // Off-topic files are dropped even when they are the lead.
  expect(
    classifyRole({ ...base, file: "Tyrannosaurus footprint.jpg", isLead: true }),
  ).toBeNull();
  expect(
    classifyRole({ ...base, file: "Dinosaur golf club logo.png" }),
  ).toBeNull();
  // A file with no keyword of its own inherits the role of the subcategory it
  // was gathered from (curator signal).
  expect(
    classifyRole({
      ...base,
      file: "Baby T-rex 0496.JPG",
      subcatRole: "ArtisticReconstruction",
    }),
  ).toBe("ArtisticReconstruction");
  // Exclusion beats an art keyword: the "Humorous paleoart" golf cartoon whose
  // categories match RESTORATION is still dropped (real Tyrannosaurus case).
  expect(
    classifyRole({
      ...base,
      file: "A cartoon golf and dinosaur club.jpg",
      categories: "Humorous paleoart|Illustrations of golf",
      isLead: true,
    }),
  ).toBeNull();
  // Size/scale diagrams are dropped — the size comparison is the synthesized hero.
  expect(
    classifyRole({ ...base, file: "Atrociraptor size comparison.png" }),
  ).toBeNull();
  expect(classifyRole({ ...base, file: "Xixianykus Scale.png" })).toBeNull();
});

function cand(
  partial: Partial<GalleryCandidate> & { role: GalleryCandidate["role"] },
): GalleryCandidate {
  const title = partial.title ?? "x.jpg";
  return {
    taxonId: partial.taxonId ?? "t1",
    role: partial.role,
    isP18: partial.isP18 ?? false,
    area: partial.area ?? 0,
    title,
    asset: {
      taxonId: partial.taxonId ?? "t1",
      type: partial.role,
      credit: "c",
      licence: "CC BY-SA 4.0",
      imageUrl: `data/images/${title}`,
      sourceUrl: `https://commons/${title}`,
    } as RawImageAsset,
  };
}

test("selectGallerySlots keeps one restoration + one fossil, restoration first (AMEND-001)", () => {
  const out = selectGallerySlots([
    cand({ role: "FossilPhoto", title: "skel-small.jpg", area: 100 }),
    cand({ role: "FossilPhoto", title: "skel-big.jpg", area: 900 }),
    cand({ role: "ArtisticReconstruction", title: "art-p18.jpg", isP18: true }),
    cand({ role: "ArtisticReconstruction", title: "art-big.jpg", area: 900 }),
  ]);
  expect(out).toHaveLength(2);
  // Restoration first, and P18 wins its slot over a larger non-P18.
  expect(out[0]!.type).toBe("ArtisticReconstruction");
  expect(out[0]!.imageUrl).toContain("art-p18.jpg");
  // Fossil second, largest area wins.
  expect(out[1]!.type).toBe("FossilPhoto");
  expect(out[1]!.imageUrl).toContain("skel-big.jpg");
});

test("selectGallerySlots omits an empty slot and is deterministic across taxa", () => {
  const out = selectGallerySlots([
    cand({ taxonId: "t2", role: "FossilPhoto", title: "b.jpg", area: 10 }),
    cand({ taxonId: "t1", role: "ArtisticReconstruction", title: "a.jpg" }),
  ]);
  // Taxa emitted in sorted id order; the fossil-only taxon yields just a fossil.
  expect(out.map((i) => i.type)).toEqual([
    "ArtisticReconstruction",
    "FossilPhoto",
  ]);
});
