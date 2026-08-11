/**
 * URL-fragment addressability for the Daily Genus screen (SPEC-019 REQ-012,
 * SPEC-020 REQ-007).
 *
 * The app has no router and neither spec introduces one: a fragment is enough to
 * make each puzzle linkable and bookmarkable, and it keeps the browser back
 * control working, because a hash change is a history entry the browser manages
 * for us. Parsing and formatting are pure so both are unit-testable without a
 * DOM.
 *
 * Four addresses, one per (track × mode) combination — a link should say which
 * puzzle it means, and with two dailies running in parallel "the daily" is no
 * longer unambiguous.
 */

import type { Track } from "./dailyGenus.js";
import type { DailyMode, Screen } from "./exploration.js";

export const DAILY_FRAGMENT = "#daily";
export const PRACTICE_FRAGMENT = "#practice";
export const DAILY_KNOWN_FRAGMENT = "#daily-known";
export const PRACTICE_KNOWN_FRAGMENT = "#practice-known";

/** What a fragment asks the shell to open, or null when it addresses nothing. */
export interface FragmentIntent {
  readonly screen: Extract<Screen, "daily">;
  readonly mode: DailyMode;
  readonly track: Track;
}

const BY_FRAGMENT: Readonly<Record<string, { mode: DailyMode; track: Track }>> =
  {
    [DAILY_FRAGMENT]: { mode: "daily", track: "full" },
    [PRACTICE_FRAGMENT]: { mode: "practice", track: "full" },
    [DAILY_KNOWN_FRAGMENT]: { mode: "daily", track: "wellKnown" },
    [PRACTICE_KNOWN_FRAGMENT]: { mode: "practice", track: "wellKnown" },
  };

/** Read an intent from a `location.hash`. Unknown fragments address nothing. */
export function parseFragment(hash: string): FragmentIntent | null {
  const found = BY_FRAGMENT[hash.trim().toLowerCase()];
  return found ? { screen: "daily", ...found } : null;
}

/**
 * The fragment a screen should carry. Screens other than the puzzle clear it —
 * they are not addressable, and a stale `#daily` would reopen the game on the
 * next load.
 */
export function fragmentFor(
  screen: Screen,
  mode: DailyMode,
  track: Track = "full",
): string {
  if (screen !== "daily") return "";
  if (track === "wellKnown") {
    return mode === "practice" ? PRACTICE_KNOWN_FRAGMENT : DAILY_KNOWN_FRAGMENT;
  }
  return mode === "practice" ? PRACTICE_FRAGMENT : DAILY_FRAGMENT;
}
