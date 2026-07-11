/**
 * Store constraint (SPEC-001 DATA-001, DATA-007). The read model is invalid if
 * it can serialize a displayable value without a resolvable source. This walks
 * every `Provenanced` field and every shown image and reports violations — the
 * structural provenance invariant, enforced by construction rather than
 * convention.
 */

import type { Provenanced, ReadModel } from '../domain/index.js';

export interface Violation {
  path: string;
  message: string;
}

function checkProvenanced(
  path: string,
  pv: Provenanced<unknown>,
  sources: ReadModel['sources'],
  out: Violation[],
): void {
  // A null value is an explicit "not available" — no source required.
  if (pv.value === null) return;
  if (pv.editorial) return; // explicitly Editorial values are allowed.
  if (pv.sourceId === null) {
    out.push({ path, message: 'displayable value has no source and is not editorial' });
    return;
  }
  if (!(pv.sourceId in sources)) {
    out.push({ path, message: `source '${pv.sourceId}' does not resolve` });
  }
}

/** Returns every DATA-001 / DATA-007 violation; an empty array means valid. */
export function validateReadModel(model: ReadModel): Violation[] {
  const out: Violation[] = [];
  const { sources } = model;

  for (const t of model.taxa) {
    checkProvenanced(`taxa[${t.id}].validity`, t.validity, sources, out);
  }

  for (const o of model.occurrences) {
    checkProvenanced(`occurrences[${o.id}].modernPosition`, o.modernPosition, sources, out);
    checkProvenanced(`occurrences[${o.id}].paleoPosition`, o.paleoPosition, sources, out);
    checkProvenanced(`occurrences[${o.id}].timeRange`, o.timeRange, sources, out);
  }

  for (const p of model.profiles) {
    const base = `profiles[${p.taxonId}]`;
    if (p.summary) checkProvenanced(`${base}.summary`, p.summary, sources, out);
    if (p.commonName) checkProvenanced(`${base}.commonName`, p.commonName, sources, out);
    for (const a of p.attributes) {
      checkProvenanced(`${base}.attributes.${a.kind}`, a.value, sources, out);
    }
    for (const m of p.measurements) {
      checkProvenanced(`${base}.measurements.${m.kind}`, m.value, sources, out);
    }
    for (const img of p.images) {
      const ipath = `${base}.images[${img.sourceUrl}]`;
      // DATA-007: a shown image must carry licence + credit and a resolvable source.
      if (!img.licence) out.push({ path: ipath, message: 'shown image has no licence' });
      if (!img.credit) out.push({ path: ipath, message: 'shown image has no credit' });
      if (!(img.sourceId in sources)) {
        out.push({ path: ipath, message: `image source '${img.sourceId}' does not resolve` });
      }
    }
  }

  return out;
}

/** Throwing variant used by the build step so a bad snapshot can never publish. */
export function assertValidReadModel(model: ReadModel): void {
  const violations = validateReadModel(model);
  if (violations.length > 0) {
    const detail = violations.map((v) => `  - ${v.path}: ${v.message}`).join('\n');
    throw new Error(`Read model violates DATA-001/DATA-007:\n${detail}`);
  }
}
