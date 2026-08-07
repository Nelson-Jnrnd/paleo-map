/**
 * Radial clade fan geometry (SPEC-017 REQ-005). Pure — angles and arc paths
 * only, no React and no DOM — so the whole layout is unit-testable and the
 * component stays a thin renderer.
 *
 * Each wedge's angle is proportional to the **genera the branch holds**, so
 * Theropoda's 1,148-taxon bulk is visible as area rather than as a number. Child
 * angles are normalised against their siblings' total, so they always exactly
 * fill the parent's arc regardless of how the parent's own count is composed.
 */

import type { ReadTaxon } from "../../domain/index.js";
import { cladeMarkerForTaxon } from "./mapCladeMarkers.js";
import type { TaxonomyIndex } from "../state/taxonomy.js";

/** How deep the fan renders below its root. Bounded for legibility (REQ-005). */
export const FAN_MAX_DEPTH = 3;

/**
 * A wedge narrower than this (radians) gets no label — a fan of 2,123 genera
 * cannot label its rim, and unlabelled wedges stay identifiable on demand.
 */
export const FAN_MIN_LABEL_ANGLE = 0.12;

export interface FanWedge {
  taxonId: string;
  name: string;
  /** 1 for the root's children, up to FAN_MAX_DEPTH. */
  depth: number;
  /** Radians, clockwise from -π/2 (twelve o'clock). */
  startAngle: number;
  endAngle: number;
  /** Genera at or below this taxon — what sizes the wedge. */
  genera: number;
  /**
   * Whether the wedge carries its name (REQ-005). Only the first ring is
   * labelled: deeper wedges in a chain (Theropoda → Neotheropoda → Averostra)
   * sit on the same angular ray at close radii, so their labels collide. The
   * textual list keeps every unlabelled wedge identifiable on demand.
   */
  labelled: boolean;
  /** Inside an avian branch, so the renderer can mark it (REQ-006). */
  avian: boolean;
  /**
   * The clade tint of the major group this branch belongs to (AMEND-001). The
   * same hue the map paints this clade's occurrence markers, so the code is
   * learnable across screens. Reinforces the label — never the only cue.
   */
  tint: string;
  /** The clade the tint stands for, for the legend and the textual list. */
  cladeLabel: string;
}

export interface FanOptions {
  maxDepth?: number;
  minLabelAngle?: number;
}

/**
 * Lay out the fan rooted at `rootId`. The root itself is not a wedge — it is the
 * hub — so the returned wedges start at depth 1 and every level partitions its
 * parent's arc.
 *
 * Branches holding no genera are omitted: a zero-width wedge is not a thing a
 * user can see or click, and including them would only distort the siblings.
 */
export function buildFan(
  index: TaxonomyIndex,
  rootId: string,
  options: FanOptions = {},
): FanWedge[] {
  const maxDepth = options.maxDepth ?? FAN_MAX_DEPTH;
  const minLabelAngle = options.minLabelAngle ?? FAN_MIN_LABEL_ANGLE;
  if (!index.inScope(rootId) || maxDepth < 1) return [];

  // Resolve a wedge's clade the same way the map resolves a marker's, so the
  // two never disagree about what colour a clade is (AMEND-001).
  const taxaById: ReadonlyMap<string, ReadTaxon> = index.byId;

  const wedges: FanWedge[] = [];

  const layout = (
    parentId: string,
    depth: number,
    from: number,
    to: number,
  ): void => {
    if (depth > maxDepth) return;
    const children = index
      .children(parentId)
      .map((child) => ({ child, genera: index.descendantGenera(child.id) }))
      .filter((entry) => entry.genera > 0);
    const total = children.reduce((sum, entry) => sum + entry.genera, 0);
    if (total === 0) return;

    let cursor = from;
    const span = to - from;
    for (const { child, genera } of children) {
      const width = (genera / total) * span;
      const start = cursor;
      const end = cursor + width;
      cursor = end;
      const marker = cladeMarkerForTaxon(child.id, taxaById);
      wedges.push({
        taxonId: child.id,
        name: child.scientificName,
        depth,
        startAngle: start,
        endAngle: end,
        genera,
        labelled: depth === 1 && width >= minLabelAngle,
        avian: index.isAvian(child.id),
        tint: marker.tint,
        cladeLabel: marker.label,
      });
      layout(child.id, depth + 1, start, end);
    }
  };

  // Start at twelve o'clock so the largest branch reads from the top.
  const origin = -Math.PI / 2;
  layout(rootId, 1, origin, origin + Math.PI * 2);
  return wedges;
}

/** Inner and outer radius of a ring, as fractions of the fan's outer radius. */
export function ringRadii(
  depth: number,
  maxDepth: number,
): { inner: number; outer: number } {
  // Leave the middle third as the hub, so the root label has room to breathe.
  const hub = 0.34;
  const band = (1 - hub) / maxDepth;
  return { inner: hub + (depth - 1) * band, outer: hub + depth * band };
}

/**
 * An SVG path for one wedge, in a viewBox centred on (0,0) with radius `radius`.
 * Drawn as an annulus segment: out along the start angle, arc across, back down
 * the end angle, arc home.
 */
export function wedgePath(
  wedge: FanWedge,
  radius: number,
  maxDepth: number,
): string {
  const { inner, outer } = ringRadii(wedge.depth, maxDepth);
  const r0 = inner * radius;
  const r1 = outer * radius;
  const { startAngle: a0, endAngle: a1 } = wedge;
  const large = a1 - a0 > Math.PI ? 1 : 0;

  const p = (r: number, a: number): string =>
    `${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;

  return [
    `M ${p(r0, a0)}`,
    `L ${p(r1, a0)}`,
    `A ${r1.toFixed(3)} ${r1.toFixed(3)} 0 ${large} 1 ${p(r1, a1)}`,
    `L ${p(r0, a1)}`,
    `A ${r0.toFixed(3)} ${r0.toFixed(3)} 0 ${large} 0 ${p(r0, a0)}`,
    "Z",
  ].join(" ");
}

/** Where a wedge's label sits: mid-angle, mid-band. */
export function labelPoint(
  wedge: FanWedge,
  radius: number,
  maxDepth: number,
): { x: number; y: number; angle: number } {
  const { inner, outer } = ringRadii(wedge.depth, maxDepth);
  const r = ((inner + outer) / 2) * radius;
  const angle = (wedge.startAngle + wedge.endAngle) / 2;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, angle };
}
