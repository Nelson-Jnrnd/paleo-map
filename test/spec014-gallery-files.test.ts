/**
 * SPEC-014 REQ-003 — gallery candidate files are deduped per taxon (by file
 * title), keep first-seen order (P18 → pageimage → category), and are capped per
 * taxon. Pure and deterministic.
 */

import { expect, test } from "vitest";
import { capFilesPerQid } from "../src/pipeline/http-client.js";

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
