/**
 * Aggregation + viewport helpers for the occurrence list (SPEC-005). Pure,
 * in-memory, O(n) over the loaded occurrences (NFR-001) so grouping and
 * viewport narrowing are unit-testable without React or a map canvas.
 */

import type { ReadOccurrence } from '../../domain/index.js';

export type GroupBy = 'taxon' | 'formation';

export interface OccurrenceGroup {
  /** Stable grouping key. */
  key: string;
  /** Display label (taxon scientific name, or formation name). */
  label: string;
  /** Present only for taxon grouping — enables the group's profile action. */
  taxonId: string | null;
  taxonName: string | null;
  occurrences: ReadOccurrence[];
}

/** Map bounds in degrees (as reported by the map). */
export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function isMappable(o: ReadOccurrence): boolean {
  return o.paleoPosition.value !== null;
}

/** Is a paleocoordinate inside the bounds (antimeridian wrap handled). */
export function withinBounds(lng: number, lat: number, b: Bounds): boolean {
  if (lat < b.south || lat > b.north) return false;
  if (b.west <= b.east) return lng >= b.west && lng <= b.east;
  // Wrapped viewport (crosses the antimeridian).
  return lng >= b.west || lng <= b.east;
}

/**
 * Narrow occurrences to those in the map viewport. A null viewport (no map /
 * WebGL) returns the full set. Occurrences without a mappable paleoposition are
 * always kept — a spatial filter must not hide unplaceable data (REQ-002).
 */
export function inViewport(
  occurrences: readonly ReadOccurrence[],
  bounds: Bounds | null,
): ReadOccurrence[] {
  if (!bounds) return [...occurrences];
  return occurrences.filter((o) => {
    const paleo = o.paleoPosition.value;
    if (!paleo) return true;
    return withinBounds(paleo.palaeoLng, paleo.palaeoLat, bounds);
  });
}

/**
 * Group occurrences by taxon (default) or formation, sorted by count descending
 * then label ascending (REQ-001).
 */
export function groupOccurrences(
  occurrences: readonly ReadOccurrence[],
  by: GroupBy,
): OccurrenceGroup[] {
  const groups = new Map<string, OccurrenceGroup>();
  for (const o of occurrences) {
    const key = by === 'taxon' ? o.taxonId : (o.formation ?? '—');
    let group = groups.get(key);
    if (!group) {
      group =
        by === 'taxon'
          ? { key, label: o.taxonName, taxonId: o.taxonId, taxonName: o.taxonName, occurrences: [] }
          : {
              key,
              label: o.formation ?? 'Unknown formation',
              taxonId: null,
              taxonName: null,
              occurrences: [],
            };
      groups.set(key, group);
    }
    group.occurrences.push(o);
  }
  return [...groups.values()].sort(
    (a, b) => b.occurrences.length - a.occurrences.length || a.label.localeCompare(b.label),
  );
}
