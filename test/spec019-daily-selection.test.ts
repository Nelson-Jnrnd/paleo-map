/**
 * SPEC-019 REQ-001, REQ-009, REQ-010, NFR-004 — the daily answer is a pure
 * function of the UTC calendar date and the pool, the countdown is computed
 * from the instant rather than ticked, and nothing here reads a clock, a DOM,
 * storage or the network.
 */

import { expect, test } from "vitest";
import {
  formatCountdown,
  msUntilNextUtcDay,
  puzzleNumber,
  selectDailyGenus,
  selectPracticeGenus,
  utcDateKey,
} from "../src/app/state/dailyGenus.js";

const pool = Array.from({ length: 37 }, (_, i) => `txn:${i}`);

test("REQ-001: the same UTC date and pool always yield the same genus", () => {
  expect(selectDailyGenus("2026-08-11", pool)).toBe(selectDailyGenus("2026-08-11", pool));
});

test("REQ-001: two machines in different time zones agree on the answer", () => {
  // 23:30 in Tokyo (UTC+9) and 10:30 in New York (UTC-4) are the same instant,
  // and the same UTC day — the point of the UTC boundary.
  const instant = new Date("2026-08-11T14:30:00Z");
  const tokyo = utcDateKey(new Date(instant.getTime()));
  const newYork = utcDateKey(new Date(instant.getTime()));
  expect(tokyo).toBe("2026-08-11");
  expect(newYork).toBe(tokyo);
  expect(selectDailyGenus(tokyo, pool)).toBe(selectDailyGenus(newYork, pool));
});

test("REQ-001: every entry is used exactly once before any repeats", () => {
  const seen = new Map<string, number>();
  const start = Date.parse("2026-08-11T00:00:00Z");
  for (let day = 0; day < pool.length; day++) {
    const key = utcDateKey(new Date(start + day * 86_400_000));
    const answer = selectDailyGenus(key, pool)!;
    seen.set(answer, (seen.get(answer) ?? 0) + 1);
  }
  expect(seen.size).toBe(pool.length);
  expect([...seen.values()].every((n) => n === 1)).toBe(true);
});

test("REQ-001: day N + poolLength repeats day N", () => {
  const start = Date.parse("2026-08-11T00:00:00Z");
  const first = selectDailyGenus(utcDateKey(new Date(start)), pool);
  const wrapped = utcDateKey(new Date(start + pool.length * 86_400_000));
  expect(selectDailyGenus(wrapped, pool)).toBe(first);
});

test("REQ-001: consecutive days never repeat the same genus", () => {
  const start = Date.parse("2026-08-11T00:00:00Z");
  for (let day = 0; day < 120; day++) {
    const a = selectDailyGenus(utcDateKey(new Date(start + day * 86_400_000)), pool);
    const b = selectDailyGenus(utcDateKey(new Date(start + (day + 1) * 86_400_000)), pool);
    expect(a).not.toBe(b);
  }
});

test("REQ-001: an empty pool selects nothing rather than throwing", () => {
  expect(selectDailyGenus("2026-08-11", [])).toBeNull();
});

test("Edge case: a clock set before the epoch still lands inside the pool", () => {
  const answer = selectDailyGenus("2019-01-01", pool);
  expect(pool).toContain(answer);
});

test("NFR-004: selection reads only its arguments — no DOM, storage or clock", () => {
  const originalDate = globalThis.Date;
  // Any wall-clock read would throw here.
  class Forbidden extends originalDate {
    constructor() {
      super();
      throw new Error("selection must not read the clock");
    }
  }
  globalThis.Date = Forbidden as unknown as DateConstructor;
  try {
    expect(selectDailyGenus("2026-08-11", pool)).toBeTruthy();
  } finally {
    globalThis.Date = originalDate;
  }
});

test("REQ-009: the countdown is the true interval to the next 00:00 UTC", () => {
  const now = new Date("2026-08-11T17:47:16Z");
  const ms = msUntilNextUtcDay(now);
  expect(ms).toBe(Date.parse("2026-08-12T00:00:00Z") - now.getTime());
  expect(formatCountdown(ms)).toBe("06:12:44");
});

test("REQ-009: a clock that jumps backwards never yields a negative remainder", () => {
  expect(msUntilNextUtcDay(new Date("2026-08-11T00:00:00Z"))).toBe(86_400_000);
  expect(formatCountdown(-5000)).toBe("00:00:00");
});

test("REQ-009: at the boundary the countdown reads a full day, not zero-forever", () => {
  expect(formatCountdown(msUntilNextUtcDay(new Date("2026-08-11T23:59:59Z")))).toBe(
    "00:00:01",
  );
});

test("puzzle numbering counts whole UTC days from the epoch", () => {
  expect(puzzleNumber("2026-08-11")).toBe(1);
  expect(puzzleNumber("2026-08-12")).toBe(2);
  expect(puzzleNumber("2026-09-10")).toBe(31);
});

test("REQ-010: practice never draws an excluded genus, and never repeats itself", () => {
  const today = pool[3]!;
  const previous = pool[9]!;
  for (let i = 0; i < pool.length * 3; i++) {
    const pick = selectPracticeGenus(pool, [today, previous], () => i / (pool.length * 3));
    expect(pick).not.toBe(today);
    expect(pick).not.toBe(previous);
    expect(pool).toContain(pick);
  }
});

test("REQ-010: practice degrades to the whole pool rather than returning nothing", () => {
  const single = ["txn:only"];
  expect(selectPracticeGenus(single, single, () => 0)).toBe("txn:only");
  expect(selectPracticeGenus([], [], () => 0)).toBeNull();
});
