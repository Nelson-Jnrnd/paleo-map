/**
 * SPEC-014 AMEND-005 — the build-time Wikipedia resolution cache: a validated
 * `taxonId → { title, url } | null` map, applied to a read model's taxa offline
 * (no network). Malformed files fail the build loudly; a missing entry is `null`.
 */

import { expect, test } from "vitest";
import { applyWikipedia, parseResolution } from "../src/pipeline/wikipedia.js";
import type { ReadModel } from "../src/domain/index.js";

function model(): ReadModel {
  return {
    metadata: {} as ReadModel["metadata"],
    sources: {},
    occurrences: [],
    profiles: [],
    taxa: [
      { id: "t:a", scientificName: "Aaa", rank: "Genus" } as never,
      { id: "t:b", scientificName: "Bbb", rank: "Genus" } as never,
    ],
  };
}

test("parseResolution accepts a valid file and rejects malformed refs", () => {
  const ok = parseResolution({
    resolvedOn: "2026-07-29",
    entries: {
      "t:a": { title: "Aaa", url: "https://en.wikipedia.org/wiki/Aaa" },
      "t:b": null,
    },
  });
  expect(ok.entries["t:b"]).toBeNull();

  expect(() =>
    parseResolution({
      resolvedOn: "2026-07-29",
      entries: { "t:a": { title: "Aaa", url: "ftp://x" } },
    }),
  ).toThrow(/http/);
  expect(() => parseResolution({ entries: {} })).toThrow(/resolvedOn/);
});

test("applyWikipedia attaches refs by taxonId and leaves the rest null", () => {
  const out = applyWikipedia(model(), {
    resolvedOn: "2026-07-29",
    entries: {
      "t:a": { title: "Aaa", url: "https://en.wikipedia.org/wiki/Aaa" },
    },
  });
  expect(out.taxa[0]!.wikipedia).toEqual({
    title: "Aaa",
    url: "https://en.wikipedia.org/wiki/Aaa",
  });
  // No entry → explicitly null (article-less), not undefined.
  expect(out.taxa[1]!.wikipedia).toBeNull();
});
