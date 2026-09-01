/**
 * Which frame the map is drawn in, and where an occurrence plots in it
 * (SPEC-029 REQ-002/REQ-003).
 *
 * Every occurrence carries two positions: the coordinates recorded with its
 * collection, and a paleocoordinate reconstructed under a stated rotation model.
 * The map can draw either — but it must draw the *same one* everywhere at once,
 * because a dot in one frame over a coastline in another is the misregistration
 * SPEC-016 exists to prevent, and it fails silently: a point in the wrong
 * hemisphere looks like data rather than like a bug.
 *
 * So placement goes through `positionIn` and nothing else. Reporting is
 * different: `OccurrencePanel` states both positions as facts about the
 * occurrence and rightly reads them directly.
 */

import type {
  ModernPosition,
  PaleogeographicPosition,
  ReadOccurrence,
} from "../../domain/index.js";

/**
 * The two frames. `paleo` is the default and the product's subject; `present` is
 * the "where would I go and look" view.
 */
export type FrameMode = "paleo" | "present";

/** A plotted point, in whichever frame produced it. */
export interface FramePoint {
  lng: number;
  lat: number;
}

/**
 * Where an occurrence plots in the given frame, or null when that frame has no
 * position for it.
 *
 * Null is a real answer, not an error: a paleocoordinate can be absent when the
 * reconstruction could not place a collection, and the callers already treat an
 * unplaceable occurrence as one that is neither drawn nor listed.
 */
export function pointIn(
  paleo: PaleogeographicPosition | null | undefined,
  modern: ModernPosition | null | undefined,
  mode: FrameMode,
): FramePoint | null {
  if (mode === "present") {
    return modern ? { lng: modern.lng, lat: modern.lat } : null;
  }
  return paleo ? { lng: paleo.palaeoLng, lat: paleo.palaeoLat } : null;
}

/**
 * The occurrence form of `pointIn`. A locality group carries the same pair of
 * positions without being an occurrence, so the rule lives in `pointIn` and both
 * callers spend it — rather than each unwrapping the frame for itself.
 */
export function positionIn(
  occurrence: ReadOccurrence,
  mode: FrameMode,
): FramePoint | null {
  return pointIn(
    occurrence.paleoPosition.value,
    occurrence.modernPosition.value,
    mode,
  );
}
