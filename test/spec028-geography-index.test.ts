/**
 * SPEC-028 REQ-001, DATA-001, SEC-001, NFR-003 — the committed country index.
 *
 * Two halves: the pure fold is tested on constructed occurrences, and the
 * **shipped artifact** is then checked against the shape the app relies on. The
 * second half is what catches a stale or hand-edited `geography.json`, which is
 * the realistic failure — the fold itself is three lines.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, describe, test } from "vitest";
import { countryOf, indexCountries } from "../src/pipeline/geography.js";
import type { GeographyIndex } from "../src/pipeline/geography.js";
import type { ReadOccurrence } from "../src/domain/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(repoRoot, "public", "data");

const occurrence = (taxonId: string, region: string | null): ReadOccurrence =>
  ({
    id: `occ:${taxonId}:${region ?? "none"}`,
    taxonId,
    modernPosition: { value: region === null ? null : { region } },
  }) as unknown as ReadOccurrence;

describe("REQ-001: the fold", () => {
  test("takes the country code from the tail of the region", () => {
    expect(countryOf(occurrence("t:a", "Alberta, CA"))).toBe("CA");
    expect(countryOf(occurrence("t:a", "MA"))).toBe("MA");
    expect(countryOf(occurrence("t:a", "Arizona/Utah, US"))).toBe("US");
  });

  test("drops anything that is not exactly two capitals, rather than repairing it", () => {
    // The shipped snapshot has two such occurrences (region tail `O2`) out of
    // 41,116. Guessing what they meant would be inventing data.
    expect(countryOf(occurrence("t:a", "Somewhere, O2"))).toBeNull();
    expect(countryOf(occurrence("t:a", "Alberta, Canada"))).toBeNull();
    expect(countryOf(occurrence("t:a", "us"))).toBeNull();
    expect(countryOf(occurrence("t:a", null))).toBeNull();
  });

  test("codes are kept verbatim as PBDB states them, never normalised to ISO", () => {
    // PBDB writes UK where ISO writes GB. Rewriting it here would make the
    // index assert something its source does not.
    expect(countryOf(occurrence("t:a", "England, UK"))).toBe("UK");
  });

  test("de-duplicates and sorts both keys and values", () => {
    const index = indexCountries([
      occurrence("t:b", "Utah, US"),
      occurrence("t:a", "Neuquén, AR"),
      occurrence("t:a", "Liaoning, CN"),
      occurrence("t:a", "Chubut, AR"),
      occurrence("t:b", "Utah, US"),
    ]);
    expect(Object.keys(index)).toEqual(["t:a", "t:b"]);
    expect(index["t:a"]).toEqual(["AR", "CN"]);
    expect(index["t:b"]).toEqual(["US"]);
  });

  test("a taxon whose every occurrence is unusable is absent, not empty", () => {
    const index = indexCountries([occurrence("t:a", "Somewhere, O2")]);
    expect(index).toEqual({});
  });

  test("NFR-003: the same input folds to the same output", () => {
    const input = [
      occurrence("t:a", "Utah, US"),
      occurrence("t:a", "Alberta, CA"),
    ];
    expect(JSON.stringify(indexCountries(input))).toBe(
      JSON.stringify(indexCountries(input)),
    );
  });
});

describe("DATA-001: the shipped artifact", () => {
  const index = JSON.parse(
    readFileSync(join(dataDir, "geography.json"), "utf-8"),
  ) as GeographyIndex;
  const reference = JSON.parse(
    readFileSync(join(dataDir, "reference.json"), "utf-8"),
  ) as { metadata: { retrievedOn: string }; taxa: { id: string }[] };

  test("is not stale: `generatedFrom` matches the shipped snapshot", () => {
    expect(index.generatedFrom).toBe(reference.metadata.retrievedOn);
  });

  test("SEC-001: it holds taxon ids and two-letter codes, and nothing else", () => {
    expect(Object.keys(index).sort()).toEqual([
      "countriesByTaxon",
      "generatedFrom",
    ]);
    for (const codes of Object.values(index.countriesByTaxon)) {
      for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  test("every taxon it names exists in the reference", () => {
    const known = new Set(reference.taxa.map((t) => t.id));
    const unknown = Object.keys(index.countriesByTaxon).filter(
      (id) => !known.has(id),
    );
    expect(unknown).toEqual([]);
  });

  test("every entry is sorted and de-duplicated", () => {
    for (const [taxonId, codes] of Object.entries(index.countriesByTaxon)) {
      expect(codes, taxonId).toEqual([...new Set(codes)].sort());
    }
  });

  test("it stays inside its payload budget", () => {
    const bytes = readFileSync(join(dataDir, "geography.json")).byteLength;
    expect(bytes).toBeLessThanOrEqual(128 * 1024);
  });

  test("it actually covers the puzzle's genera", () => {
    // A gate that finds nothing proves nothing: the index is only worth loading
    // if it answers for most of what the game can ask about.
    expect(Object.keys(index.countriesByTaxon).length).toBeGreaterThan(1500);
  });
});
