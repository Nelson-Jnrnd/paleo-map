/**
 * SPEC-020 REQ-002, REQ-003, REQ-008, NFR-004 — the well-known pool and the two
 * parallel tracks, checked against the **shipped** artifact: the rank cut, the
 * floor, determinism, and the guarantee that the full track is untouched.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { ReadModel } from "../src/domain/index.js";
import { buildTaxonomyIndex } from "../src/app/state/taxonomy.js";
import {
  MIN_WELL_KNOWN_POOL,
  WELL_KNOWN_POOL_SIZE,
  buildGameData,
  deriveWellKnownPool,
  poolForTrack,
  saltForTrack,
  selectDailyGenus,
  trackAvailable,
  utcDateKey,
} from "../src/app/state/dailyGenus.js";

const model = JSON.parse(
  readFileSync("public/data/reference.json", "utf8"),
) as ReadModel;
const profiles = new Map(model.profiles.map((p) => [p.taxonId, p]));
const index = buildTaxonomyIndex(model.taxa);
const data = buildGameData(model.taxa, index, (id) => profiles.get(id));
const names = new Map(model.taxa.map((t) => [t.id, t.scientificName]));
const viewsOf = (id: string): number | null => profiles.get(id)?.popularity ?? null;

test("REQ-002: the shipped well-known pool is exactly the rank cut", () => {
  expect(data.wellKnownPool).toHaveLength(WELL_KNOWN_POOL_SIZE);
  expect(data.wellKnownPool.length).toBeGreaterThanOrEqual(MIN_WELL_KNOWN_POOL);
});

test("REQ-002: every entry is in the answer pool and has an established figure", () => {
  const pool = new Set(data.pool);
  for (const id of data.wellKnownPool) {
    expect(pool.has(id)).toBe(true);
    expect(typeof viewsOf(id)).toBe("number");
  }
});

test("REQ-002: it is ranked by views, and nothing outside it is more read", () => {
  const inside = data.wellKnownPool.map((id) => viewsOf(id)!);
  for (let i = 1; i < inside.length; i++) {
    expect(inside[i - 1]!).toBeGreaterThanOrEqual(inside[i]!);
  }
  const cutoff = inside[inside.length - 1]!;
  const chosen = new Set(data.wellKnownPool);
  for (const id of data.pool) {
    const views = viewsOf(id);
    if (views === null || chosen.has(id)) continue;
    expect(views).toBeLessThanOrEqual(cutoff);
  }
});

test("REQ-002: a genus with no established figure is excluded, never ranked last", () => {
  const unresolved = data.pool.filter((id) => viewsOf(id) === null);
  expect(unresolved.length).toBeGreaterThan(0); // the snapshot has some
  for (const id of unresolved) expect(data.wellKnownPool).not.toContain(id);
});

test("REQ-002: the cut is deterministic — every entry tied, ties break by name", () => {
  // Enough entries to clear the floor, all on the same view count, inserted in
  // reverse name order: only the tie-break can produce the expected ordering.
  const size = WELL_KNOWN_POOL_SIZE + 20;
  const ids = Array.from({ length: size }, (_, i) => `t:${i}`);
  const nameOf = (id: string): string =>
    `Genus${String(size - Number(id.slice(2))).padStart(4, "0")}`;
  const guessable = new Map(
    ids.map((id) => [id, { id, scientificName: nameOf(id) } as never]),
  );
  const allTied = (): never => ({ popularity: 4242 }) as never;

  const pool = deriveWellKnownPool(ids, guessable, allTied);
  expect(pool).toHaveLength(WELL_KNOWN_POOL_SIZE);
  const chosenNames = pool.map(nameOf);
  expect(chosenNames).toEqual([...chosenNames].sort());
  // Same input in a different order yields the same cut.
  expect(deriveWellKnownPool([...ids].reverse(), guessable, allTied)).toEqual(pool);
});

test("REQ-002/NFR-004: re-deriving from the same model is byte-stable", () => {
  const again = buildGameData(model.taxa, buildTaxonomyIndex(model.taxa), (id) =>
    profiles.get(id),
  );
  expect(again.wellKnownPool).toEqual(data.wellKnownPool);
});

test("REQ-002: below the floor the track is withheld, not shipped degraded", () => {
  const thin = data.pool.slice(0, MIN_WELL_KNOWN_POOL - 1);
  const pool = deriveWellKnownPool(thin, data.guessableById, (id) =>
    profiles.get(id),
  );
  expect(pool).toEqual([]);
});

test("REQ-008: with no popularity at all, only the full track is offered", () => {
  const bare = buildGameData(model.taxa, index, (id) => {
    const p = profiles.get(id);
    return p ? ({ ...p, popularity: null } as never) : undefined;
  });
  expect(bare.wellKnownPool).toEqual([]);
  expect(trackAvailable(bare, "wellKnown")).toBe(false);
  expect(trackAvailable(bare, "full")).toBe(true);
  // And the full track is completely unaffected.
  expect(bare.pool).toEqual(data.pool);
});

test("REQ-003: each track selects over its own pool", () => {
  expect(poolForTrack(data, "full")).toBe(data.pool);
  expect(poolForTrack(data, "wellKnown")).toBe(data.wellKnownPool);
});

test("REQ-003: both tracks are deterministic and cycle their whole pool", () => {
  for (const track of ["full", "wellKnown"] as const) {
    const pool = poolForTrack(data, track);
    const start = Date.parse("2026-08-11T00:00:00Z");
    const seen = new Set<string>();
    for (let day = 0; day < pool.length; day++) {
      const key = utcDateKey(new Date(start + day * 86_400_000));
      const answer = selectDailyGenus(key, pool, saltForTrack(track))!;
      expect(selectDailyGenus(key, pool, saltForTrack(track))).toBe(answer);
      seen.add(answer);
    }
    expect(seen.size).toBe(pool.length);
  }
});

test("REQ-003: the two tracks are independent — neither suppresses the other", () => {
  // They may coincide on a day; what matters is that each is its own function.
  const key = "2026-08-11";
  const full = selectDailyGenus(key, data.pool, saltForTrack("full"));
  const known = selectDailyGenus(
    key,
    data.wellKnownPool,
    saltForTrack("wellKnown"),
  );
  expect(full).toBeTruthy();
  expect(known).toBeTruthy();
  expect(data.wellKnownPool).toContain(known);

  // Each track has its own ordering, so switching on any given day is a real
  // change rather than the same puzzle twice (REQ-003).
  const start = Date.parse("2026-08-11T00:00:00Z");
  let identical = 0;
  for (let day = 0; day < 30; day++) {
    const d = utcDateKey(new Date(start + day * 86_400_000));
    if (
      selectDailyGenus(d, data.pool, saltForTrack("full")) ===
      selectDailyGenus(d, data.wellKnownPool, saltForTrack("wellKnown"))
    ) {
      identical++;
    }
  }
  // Coinciding is allowed, but must be occasional rather than the rule.
  expect(identical).toBeLessThan(6);
});

test("REQ-008: the full track's answers are unchanged by the well-known pool", () => {
  // The full track is selected from `data.pool`, which the popularity data does
  // not touch — asserted directly so a future change to the ranking cannot
  // silently move the shipped puzzle.
  const withoutPopularity = buildGameData(model.taxa, index, (id) => {
    const p = profiles.get(id);
    return p ? ({ ...p, popularity: null } as never) : undefined;
  });
  const start = Date.parse("2026-08-11T00:00:00Z");
  for (let day = 0; day < 40; day++) {
    const key = utcDateKey(new Date(start + day * 86_400_000));
    expect(selectDailyGenus(key, data.pool)).toBe(
      selectDailyGenus(key, withoutPopularity.pool),
    );
  }
});

test("REQ-002: the track excludes the trace-fossil and eggshell genera", () => {
  // Not by an exclusion list — they simply are not read about (Context).
  const chosen = new Set(data.wellKnownPool.map((id) => names.get(id)));
  for (const trace of [
    "Wintonopus",
    "Deltapodus",
    "Anomoepus",
    "Megalosauripus",
    "Cairanoolithus",
    "Elongatoolithus",
  ]) {
    expect(chosen.has(trace)).toBe(false);
  }
});
