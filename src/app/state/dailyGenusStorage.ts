/**
 * Daily Genus persistence and the shared summary (SPEC-019 REQ-011, SEC-002).
 *
 * Every read and write of browser storage in this feature goes through this
 * module, so SEC-002 ("the stored payload is ids, counts, dates and outcomes,
 * and nothing else") is checkable in one place. Nothing here reaches the
 * network, and a storage that throws, is full, or holds garbage is treated as
 * "no stored state" rather than an error the player has to see (Error handling).
 *
 * Practice rounds are deliberately not persisted (Assumptions 6): they are
 * throwaway, and keeping them out holds the stored schema to the daily.
 */

import { MAX_GUESSES, puzzleNumber } from "./dailyGenus.js";
import type { Round } from "./dailyGenus.js";

const STATE_KEY = "paleo-map:daily-genus:round";
const RECORD_KEY = "paleo-map:daily-genus:record";

/** The minimum of `Storage` this module uses, so tests can inject a stub. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** One stored guess. Names and ids only — no free text (SEC-002). */
export interface StoredGuess {
  readonly taxonId: string;
  readonly scientificName: string;
}

/** Today's round, keyed by UTC date so yesterday's never resumes (REQ-011). */
export interface StoredRound {
  readonly dateKey: string;
  readonly answerId: string;
  readonly guesses: readonly StoredGuess[];
  readonly hintUsed: boolean;
  readonly outcome: "playing" | "won" | "lost";
}

/** The running record. Counts and dates only. */
export interface StoredRecord {
  readonly played: number;
  readonly won: number;
  readonly streak: number;
  readonly bestStreak: number;
  /** Winning guess counts, keyed by guess number as a string. */
  readonly distribution: Readonly<Record<string, number>>;
  /** UTC date of the last completed round, for streak continuity. */
  readonly lastPlayed: string | null;
}

export const EMPTY_RECORD: StoredRecord = {
  played: 0,
  won: 0,
  streak: 0,
  bestStreak: 0,
  distribution: {},
  lastPlayed: null,
};

/** The store, or null when the browser denies it (private mode, blocked cookies). */
export function browserStore(): KeyValueStore | null {
  try {
    const store = globalThis.localStorage;
    if (!store) return null;
    // Touch it: some browsers expose the object but throw on access.
    const probe = "paleo-map:probe";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

function readJson<T>(store: KeyValueStore | null, key: string): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Malformed JSON is treated as absent, never migrated or repaired.
    return null;
  }
}

/** Writes are best-effort: a full or denied store must not break the round. */
function writeJson(
  store: KeyValueStore | null,
  key: string,
  value: unknown,
): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Today's stored round, or null when there is none *for this UTC date*. State
 * left by an earlier date is discarded rather than migrated (Error handling).
 */
export function loadRound(
  store: KeyValueStore | null,
  dateKey: string,
): StoredRound | null {
  const stored = readJson<StoredRound>(store, STATE_KEY);
  if (!stored || stored.dateKey !== dateKey) return null;
  if (!Array.isArray(stored.guesses) || typeof stored.answerId !== "string")
    return null;
  return stored;
}

/** Persist a daily round. Practice rounds are never written (REQ-011). */
export function saveRound(store: KeyValueStore | null, round: Round): boolean {
  if (round.mode !== "daily" || !round.dateKey) return false;
  const payload: StoredRound = {
    dateKey: round.dateKey,
    answerId: round.answerId,
    guesses: round.guesses.map((g) => ({
      taxonId: g.taxonId,
      scientificName: g.scientificName,
    })),
    hintUsed: round.hintUsed,
    outcome: round.outcome,
  };
  return writeJson(store, STATE_KEY, payload);
}

export function loadRecord(store: KeyValueStore | null): StoredRecord {
  const stored = readJson<StoredRecord>(store, RECORD_KEY);
  if (!stored || typeof stored.played !== "number") return EMPTY_RECORD;
  return { ...EMPTY_RECORD, ...stored };
}

/**
 * Fold a finished daily round into the record. A streak continues only when the
 * previous completed round was the day before; anything else restarts it.
 */
export function recordRound(record: StoredRecord, round: Round): StoredRecord {
  if (round.mode !== "daily" || !round.dateKey) return record;
  if (round.outcome === "playing") return record;
  if (record.lastPlayed === round.dateKey) return record;

  const won = round.outcome === "won";
  const consecutive =
    record.lastPlayed !== null &&
    puzzleNumber(round.dateKey) - puzzleNumber(record.lastPlayed) === 1;
  const streak = won ? (consecutive ? record.streak + 1 : 1) : 0;
  const distribution = { ...record.distribution };
  if (won) {
    const key = String(round.guesses.length);
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  return {
    played: record.played + 1,
    won: record.won + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    distribution,
    lastPlayed: round.dateKey,
  };
}

export function saveRecord(
  store: KeyValueStore | null,
  record: StoredRecord,
): boolean {
  return writeJson(store, RECORD_KEY, record);
}

/**
 * The shared summary (REQ-011). Spoiler-free by construction: it contains the
 * puzzle number, the guess count, a hint marker, and one mark per guess — `▲`
 * where that guess pushed the tree deeper, `·` where it did not. No taxon name,
 * rank or clade name, and no depth or distance number, consistent with REQ-004.
 */
export function shareSummary(round: Round): string {
  const n = round.dateKey ? puzzleNumber(round.dateKey) : 0;
  const score =
    round.outcome === "won"
      ? `${round.guesses.length}/${MAX_GUESSES}`
      : `X/${MAX_GUESSES}`;
  let deepest = -1;
  const marks = round.guesses.map((g) => {
    if (g.sharedDepth > deepest) {
      deepest = g.sharedDepth;
      return "▲";
    }
    return "·";
  });
  const hint = round.hintUsed ? " · hint" : "";
  return `Daily Genus ${n} · ${score}${hint} · ${marks.join("")}`;
}
