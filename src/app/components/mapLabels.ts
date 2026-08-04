/**
 * Map label placement (SPEC-015 REQ-002). Pure greedy collision culling for the
 * DOM-overlay taxon labels: given already-projected candidate points (pixel
 * coordinates from the map), keep as many non-overlapping labels as possible and
 * drop the rest, so names never stack illegibly. Kept framework- and map-free so
 * it is unit-testable; the projection + zoom gating live in `OccurrenceMap`.
 */

export interface LabelCandidate {
  id: string;
  taxon: string;
  /** Pixel position of the marker within the map container. */
  x: number;
  y: number;
  /**
   * SPEC-017 REQ-008: this marker belongs to the focused taxon. Focused
   * candidates are placed first, so the `maxLabels` cap cannot be spent naming
   * the de-emphasised markers around a selection while the selected taxon itself
   * goes unlabelled.
   */
  focused?: boolean;
}

export type MapLabel = LabelCandidate;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export interface LabelLayoutOptions {
  /** Cap on rendered labels (perf + restraint). */
  maxLabels?: number;
  /** Approx px per character, for the collision box width estimate. */
  charWidth?: number;
  /** Approx label box height in px. */
  lineHeight?: number;
  /** Horizontal gap between the marker and its label. */
  offsetX?: number;
}

/**
 * Greedily place labels in candidate order, skipping any whose estimated box
 * overlaps an already-placed one. Returns the accepted labels (a subset), capped
 * at `maxLabels`.
 *
 * Focused candidates (SPEC-017 REQ-008) are considered first; within each of the
 * two bands the caller's order is preserved, so placement stays deterministic
 * and unchanged when nothing is focused.
 */
export function computeMapLabels(
  candidates: readonly LabelCandidate[],
  options: LabelLayoutOptions = {},
): MapLabel[] {
  const {
    maxLabels = 60,
    charWidth = 6.5,
    lineHeight = 16,
    offsetX = 10,
  } = options;
  const ordered = candidates.some((c) => c.focused)
    ? [
        ...candidates.filter((c) => c.focused),
        ...candidates.filter((c) => !c.focused),
      ]
    : candidates;
  const placed: Box[] = [];
  const out: MapLabel[] = [];
  for (const c of ordered) {
    if (out.length >= maxLabels) break;
    const width = Math.max(1, c.taxon.length) * charWidth;
    const left = c.x + offsetX;
    const box: Box = {
      left,
      right: left + width,
      top: c.y - lineHeight / 2,
      bottom: c.y + lineHeight / 2,
    };
    if (placed.some((p) => overlaps(p, box))) continue;
    placed.push(box);
    out.push(c);
  }
  return out;
}
