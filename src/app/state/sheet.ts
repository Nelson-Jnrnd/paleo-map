/**
 * The occurrence sheet's rest positions (SPEC-030 REQ-003, API-001).
 *
 * Internal only. The stop is deliberately **not** addressable and **not**
 * persisted: SPEC-022 API-001 freezes the fragment vocabulary to the puzzle's
 * own addresses, and a sheet that reopens half-raised because of what someone
 * did last week is a surprise, not a convenience.
 *
 * The geometry lives here as pure functions so it is testable in jsdom, which
 * cannot do layout. Everything below is arithmetic on a container height.
 */

/** The three rest positions, ordered peek → half → full. */
export type SheetStop = "peek" | "half" | "full";

export const SHEET_STOPS: readonly SheetStop[] = ["peek", "half", "full"];

/**
 * Peek shows the handle and the in-view count, and nothing else.
 *
 * It carried the five-unit selector too until 2026-09-03, at 152px. The owner's
 * verdict on the result was that the map has to be the star of the screen, so
 * the selector moved below the fold: it is one drag away at the half stop, and
 * the 80px it cost is the single largest piece of map this layout got back.
 */
export const PEEK_HEIGHT_PX = 76;

/**
 * REQ-003: at the full stop the map keeps at least 25% of the space below the
 * timeline. The sheet is never a full-screen takeover — the map behind it stays
 * readable and interactive, which is what keeps SPEC-009 REQ-006's two-way
 * highlight meaningful.
 */
export const FULL_MAX_FRACTION = 0.75;
const HALF_FRACTION = 0.5;

/**
 * REQ-003 acceptance criterion 1: at the peek stop the map keeps at least 55% of
 * the container, so the sheet at rest never becomes the screen.
 *
 * This is a *clamp*, not just a nominal height, and that distinction was a bug.
 * `PEEK_HEIGHT_PX` is what the peek contents need; on a tall phone it is well
 * under the cap and the cap does nothing. On a 320×568 screen the container is
 * only ~200px, and clamping the fixed 152px against `FULL_MAX_FRACTION` instead
 * left the map at 25% — criterion 1 violated at a width the gate did not check.
 */
const PEEK_MAX_FRACTION = 1 - 0.55;

/** Cycle to the next stop, wrapping from full back to peek (REQ-003). */
export function advanceStop(stop: SheetStop): SheetStop {
  const next = SHEET_STOPS.indexOf(stop) + 1;
  return SHEET_STOPS[next % SHEET_STOPS.length] as SheetStop;
}

/** The sheet's height, in pixels, for a stop in a container of `containerPx`. */
export function stopHeight(stop: SheetStop, containerPx: number): number {
  if (containerPx <= 0) return 0;
  const full = containerPx * FULL_MAX_FRACTION;
  // Clamped so the map keeps its 55% at rest whatever the container, and so the
  // ordering peek ≤ half ≤ full holds even on a container short enough that the
  // fixed peek would otherwise exceed the capped full stop — a drag can then
  // never invert them.
  const peek = Math.min(PEEK_HEIGHT_PX, containerPx * PEEK_MAX_FRACTION, full);
  switch (stop) {
    case "peek":
      return peek;
    case "half":
      return Math.max(peek, Math.min(containerPx * HALF_FRACTION, full));
    case "full":
      return full;
  }
}

/**
 * The stop whose height is closest to `heightPx` — where a drag settles.
 *
 * Nearest-by-distance rather than by direction: a reader who drags most of the
 * way to full and lets go expects full, whichever way they were moving.
 */
export function nearestStop(heightPx: number, containerPx: number): SheetStop {
  let best: SheetStop = "peek";
  let bestGap = Number.POSITIVE_INFINITY;
  for (const stop of SHEET_STOPS) {
    const gap = Math.abs(stopHeight(stop, containerPx) - heightPx);
    if (gap < bestGap) {
      bestGap = gap;
      best = stop;
    }
  }
  return best;
}

/**
 * The stop to show a detail at (REQ-004). Selecting something on the map while
 * the sheet is at peek raises it to half — otherwise the detail opens in a
 * 152px slot and the reader has to go looking for what they just tapped. A
 * sheet already at half or full is left where the reader put it.
 */
export function stopForDetail(stop: SheetStop): SheetStop {
  return stop === "peek" ? "half" : stop;
}
