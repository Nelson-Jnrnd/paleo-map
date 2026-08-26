/**
 * Shared box geometry for the layout gates (SPEC-023 NFR-001, SPEC-025 NFR-001).
 *
 * One definition, imported by both suites, so they cannot drift on the tolerance
 * or on what "not overlapping" means. It lives outside the `*.e2e.ts` pattern
 * because Playwright forbids one test file importing another.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Sub-pixel layout rounding is not a collision. */
export function disjoint(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w <= 0.5 || h <= 0.5;
}

/** True when `inner` sits entirely within `outer`, to the same tolerance. */
export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}
