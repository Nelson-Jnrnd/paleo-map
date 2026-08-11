/**
 * URL-fragment addressability for the Daily Genus screen (SPEC-019 REQ-012).
 *
 * The app has no router and this spec does not introduce one: a fragment is
 * enough to make the puzzle linkable and bookmarkable, and it keeps the browser
 * back control working, because a hash change is a history entry the browser
 * manages for us. Parsing and formatting are pure so both are unit-testable
 * without a DOM.
 */

import type { DailyMode, Screen } from "./exploration.js";

export const DAILY_FRAGMENT = "#daily";
export const PRACTICE_FRAGMENT = "#practice";

/** What a fragment asks the shell to open, or null when it addresses nothing. */
export interface FragmentIntent {
  readonly screen: Extract<Screen, "daily">;
  readonly mode: DailyMode;
}

/** Read an intent from a `location.hash`. Unknown fragments address nothing. */
export function parseFragment(hash: string): FragmentIntent | null {
  const normalized = hash.trim().toLowerCase();
  if (normalized === DAILY_FRAGMENT) return { screen: "daily", mode: "daily" };
  if (normalized === PRACTICE_FRAGMENT)
    return { screen: "daily", mode: "practice" };
  return null;
}

/**
 * The fragment a screen should carry. Screens other than the puzzle clear it —
 * they are not addressable, and a stale `#daily` would reopen the game on the
 * next load.
 */
export function fragmentFor(screen: Screen, mode: DailyMode): string {
  if (screen !== "daily") return "";
  return mode === "practice" ? PRACTICE_FRAGMENT : DAILY_FRAGMENT;
}
