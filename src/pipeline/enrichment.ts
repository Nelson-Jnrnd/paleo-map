/**
 * Enrichment cache — the contract (SPEC-014 REQ-002). Enrichment is defined by a
 * fixed schema plus a **revision-keyed cache** of `enrichment/<taxonId>.json`
 * files, each carrying one taxon's {@link EnrichmentRecord} plus the source
 * article and its `revid`. Populating the cache is engine-agnostic (agent-authored
 * by default, an optional batch script otherwise); the build only ever **reads**
 * the committed cache and never calls an LLM, so the snapshot stays deterministic
 * and offline (NFR-001).
 *
 * This module is the schema validator + cache key + loader. The validator rejects
 * malformed records regardless of which engine wrote them (REQ-002 acceptance),
 * so a bad hand-authored or script-authored file fails the build loudly rather
 * than shipping junk.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  EnrichmentConfidence,
  EnrichmentRecord,
  EnrichedMeasurement,
} from '../domain/enrichment.js';
import type { ReadModel } from '../domain/snapshot.js';

/** Which engine authored a cache entry (REQ-002). Content is identical either way. */
export type EnrichmentEngine = 'agent' | 'batch';

/** The committed cache file: provenance envelope + the extracted record. */
export interface EnrichmentCacheEntry {
  taxonId: string;
  /** Scientific name, for human-readability of the committed file. */
  taxonName: string;
  source: {
    /** Wikipedia article title. */
    article: string;
    url: string;
    /** MediaWiki revision id the record was extracted from (freshness key). */
    revid: number;
  };
  engine: EnrichmentEngine;
  /** ISO date the record was authored. */
  assertedOn: string;
  record: EnrichmentRecord;
}

export type ValidationResult =
  | { ok: true; entry: EnrichmentCacheEntry }
  | { ok: false; errors: string[] };

const CONFIDENCES: readonly EnrichmentConfidence[] = ['stated', 'estimated'];
const ENGINES: readonly EnrichmentEngine[] = ['agent', 'batch'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A finite number (rejects NaN/Infinity that JSON.parse can't produce but code can). */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

/** Assert a condition, recording a message when it fails; returns the condition. */
function req(cond: boolean, msg: string, errors: string[]): boolean {
  if (!cond) errors.push(msg);
  return cond;
}

/** Validate one measurement field; pushes prefixed errors, returns validity. */
function checkMeasurement(
  v: unknown,
  path: string,
  errors: string[],
): v is EnrichedMeasurement | null {
  if (v === null) return true;
  if (!isObject(v)) {
    errors.push(`${path} must be an object or null`);
    return false;
  }
  let ok = true;
  ok = req(isNum(v.value), `${path}.value must be a number`, errors) && ok;
  ok = req(typeof v.unit === 'string' && v.unit.length > 0, `${path}.unit must be a non-empty string`, errors) && ok;
  ok = req(v.low === null || isNum(v.low), `${path}.low must be a number or null`, errors) && ok;
  ok = req(v.high === null || isNum(v.high), `${path}.high must be a number or null`, errors) && ok;
  ok =
    req(
      CONFIDENCES.includes(v.confidence as EnrichmentConfidence),
      `${path}.confidence must be one of ${CONFIDENCES.join('|')}`,
      errors,
    ) && ok;
  return ok;
}

/** Validate the record body (SPEC-014 REQ-001 schema). */
function checkRecord(v: unknown, errors: string[]): v is EnrichmentRecord {
  if (!isObject(v)) {
    errors.push('record must be an object');
    return false;
  }
  let ok = true;
  const stringFields = ['commonName', 'pronunciation', 'nameMeaning', 'oneLiner', 'description', 'diet', 'era'] as const;
  for (const f of stringFields) {
    ok = req(isNullableString(v[f]), `record.${f} must be a string or null`, errors) && ok;
  }
  ok = checkMeasurement(v.bodyLength, 'record.bodyLength', errors) && ok;
  ok = checkMeasurement(v.height, 'record.height', errors) && ok;
  ok = checkMeasurement(v.mass, 'record.mass', errors) && ok;

  if (v.discovery !== null) {
    if (!isObject(v.discovery)) {
      ok = req(false, 'record.discovery must be an object or null', errors) && ok;
    } else {
      ok = req(v.discovery.year === null || isNum(v.discovery.year), 'record.discovery.year must be a number or null', errors) && ok;
      ok = req(isNullableString(v.discovery.who), 'record.discovery.who must be a string or null', errors) && ok;
      ok = req(isNullableString(v.discovery.where), 'record.discovery.where must be a string or null', errors) && ok;
    }
  }

  if (!Array.isArray(v.notableFacts)) {
    ok = req(false, 'record.notableFacts must be an array', errors) && ok;
  } else {
    v.notableFacts.forEach((fact, i) => {
      const valid = isObject(fact) && typeof fact.tag === 'string' && typeof fact.text === 'string';
      ok = req(valid, `record.notableFacts[${i}] must be { tag: string, text: string }`, errors) && ok;
    });
  }
  return ok;
}

/**
 * Validate a parsed cache entry (envelope + record). Pure; every problem is
 * reported so a malformed file fails the build with an actionable message.
 */
export function validateCacheEntry(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ['entry must be an object'] };

  if (typeof value.taxonId !== 'string' || value.taxonId.length === 0)
    errors.push('taxonId must be a non-empty string');
  if (typeof value.taxonName !== 'string' || value.taxonName.length === 0)
    errors.push('taxonName must be a non-empty string');
  if (!ENGINES.includes(value.engine as EnrichmentEngine))
    errors.push(`engine must be one of ${ENGINES.join('|')}`);
  if (typeof value.assertedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value.assertedOn))
    errors.push('assertedOn must be an ISO date string');

  const src = value.source;
  if (!isObject(src)) {
    errors.push('source must be an object');
  } else {
    if (typeof src.article !== 'string' || src.article.length === 0)
      errors.push('source.article must be a non-empty string');
    if (typeof src.url !== 'string' || !src.url.startsWith('http'))
      errors.push('source.url must be an http(s) URL');
    if (!isNum(src.revid) || src.revid <= 0)
      errors.push('source.revid must be a positive number');
  }

  checkRecord(value.record, errors);

  return errors.length === 0
    ? { ok: true, entry: value as unknown as EnrichmentCacheEntry }
    : { ok: false, errors };
}

/**
 * A cached record is reusable without any LLM call when the article revision is
 * unchanged (REQ-002). Freshness is exactly that revid match.
 */
export function isFresh(entry: EnrichmentCacheEntry, currentRevid: number): boolean {
  return entry.source.revid === currentRevid;
}

/**
 * Load and validate every `<taxonId>.json` under an enrichment cache directory
 * into a `taxonId → entry` map. A malformed file throws with its path so the
 * build fails loudly; a missing directory yields an empty map (nothing enriched).
 */
export async function loadEnrichmentCache(
  dir: string,
): Promise<Map<string, EnrichmentCacheEntry>> {
  const out = new Map<string, EnrichmentCacheEntry>();
  const files = await readdir(dir).catch(() => [] as string[]);
  for (const name of files.sort()) {
    if (!name.endsWith('.json')) continue;
    const path = join(dir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, 'utf-8'));
    } catch (err) {
      throw new Error(`enrichment cache: ${path} is not valid JSON — ${String(err)}`);
    }
    const result = validateCacheEntry(parsed);
    if (!result.ok) {
      throw new Error(`enrichment cache: ${path} is invalid:\n  - ${result.errors.join('\n  - ')}`);
    }
    out.set(result.entry.taxonId, result.entry);
  }
  return out;
}

/**
 * Attach cached enrichment records to a read model's profiles by taxonId
 * (SPEC-014 REQ-002). Pure: returns a new model with `profile.enrichment` set
 * where the cache covers a taxon and left `null` otherwise. Cache entries with no
 * matching profile are ignored (a taxon may have left the snapshot). The build is
 * deterministic given the committed cache — no network, no LLM.
 */
export function applyEnrichment(
  model: ReadModel,
  cache: ReadonlyMap<string, EnrichmentCacheEntry>,
): ReadModel {
  return {
    ...model,
    profiles: model.profiles.map((p) => {
      const entry = cache.get(p.taxonId);
      return entry ? { ...p, enrichment: entry.record } : p;
    }),
  };
}
