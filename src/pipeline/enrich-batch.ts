/**
 * Engine B — batch enrichment authoring (SPEC-014 REQ-002, the "optional batch
 * script"). This module is the **pure, testable core**: the extraction prompt,
 * the response parser that turns a model's JSON reply into a schema-clean
 * {@link EnrichmentRecord}, and the envelope builder. It performs no network I/O
 * and calls no LLM — `scripts/enrich_batch.ts` supplies the Anthropic Message
 * Batches transport around it.
 *
 * Engine B produces the **same cache entry** as the agent-authored Engine A
 * (`enrichment/<taxonId>.json`); the only difference is `engine: 'batch'`. The
 * cache is the contract, so every batch-authored file is validated by the same
 * `validateCacheEntry` before it is written (extract-don't-invent, REQ-001).
 */

import type {
  EnrichedMeasurement,
  EnrichmentConfidence,
  EnrichmentDiscovery,
  EnrichmentFact,
  EnrichmentRecord,
} from '../domain/enrichment.js';
import type { EnrichmentCacheEntry } from './enrichment.js';

/** What the model is told to do, once per batch request (extract-don't-invent). */
export const EXTRACTION_SYSTEM =
  'You extract a structured record about an extinct animal from the text of its ' +
  'Wikipedia article. You are an extractor, not an author: every value must be ' +
  'supported by the article. If the article does not state a fact, its field is ' +
  'null — never guess, never fill from outside knowledge. Reply with a single ' +
  'JSON object and nothing else (no prose, no markdown fence).';

/** The extraction schema, described in-prompt so the reply matches the record shape. */
const SCHEMA_DOC = `Return exactly this JSON shape (all fields required; use null when the article does not state the fact):
{
  "commonName": string|null,        // vernacular name if given (e.g. "tyrant lizard"), else null
  "pronunciation": string|null,     // phonetic guide if given (e.g. "tie-RAN-oh-SORE-us")
  "nameMeaning": string|null,       // what the genus name means, if stated
  "oneLiner": string|null,          // one plain sentence: what this animal was
  "description": string|null,       // 2-4 plain sentences, article-grounded
  "bodyLength": Measurement|null,   // total length
  "height": Measurement|null,       // hip/standing height if stated
  "mass": Measurement|null,         // body mass / weight
  "diet": string|null,              // e.g. "Carnivore", "Herbivore", "Piscivore"
  "era": string|null,               // period/epoch context, e.g. "Late Cretaceous (Campanian)"
  "discovery": { "year": number|null, "who": string|null, "where": string|null }|null,
  "notableFacts": Fact[]            // 0-4 items; [] if none clearly stand out
}
Measurement = { "value": number, "unit": string, "low": number|null, "high": number|null, "confidence": "stated"|"estimated" }
Fact = { "tag": string, "text": string }   // tag is one lowercase word (e.g. "size", "diet", "speed")
Rules: prefer metres for length/height and kilograms or tonnes for mass; set confidence "stated" only when the article gives that exact figure, otherwise "estimated". Keep text concise and neutral.`;

/** The per-taxon user message: the schema doc + the article to extract from. */
export function buildUserPrompt(taxonName: string, article: string): string {
  return (
    `Genus: ${taxonName}\n\n` +
    `${SCHEMA_DOC}\n\n` +
    `Article text follows between the markers.\n<article>\n${article}\n</article>`
  );
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function normalizeMeasurement(v: unknown): EnrichedMeasurement | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const value = asFiniteNumber(o.value);
  const unit = asString(o.unit);
  // A measurement without a numeric value + unit is not a measurement — drop it.
  if (value === null || unit === null) return null;
  const confidence: EnrichmentConfidence =
    o.confidence === 'stated' ? 'stated' : 'estimated';
  return {
    value,
    unit,
    low: asFiniteNumber(o.low),
    high: asFiniteNumber(o.high),
    confidence,
  };
}

function normalizeDiscovery(v: unknown): EnrichmentDiscovery | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const year = asFiniteNumber(o.year);
  const who = asString(o.who);
  const where = asString(o.where);
  // All-null discovery carries no information — collapse to null.
  if (year === null && who === null && where === null) return null;
  return { year, who, where };
}

function normalizeFacts(v: unknown): EnrichmentFact[] {
  if (!Array.isArray(v)) return [];
  const out: EnrichmentFact[] = [];
  for (const item of v) {
    if (item === null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const tag = asString(o.tag);
    const text = asString(o.text);
    if (tag && text) out.push({ tag, text });
    if (out.length === 4) break; // REQ-001: at most 4 notable facts
  }
  return out;
}

/**
 * Coerce a parsed model reply into a schema-clean record: pick only known fields,
 * default anything missing/malformed to null (or [] for facts), and drop
 * degenerate measurements. Defensive by design — the model may omit fields or add
 * extras, and the record still has to pass `validateCacheEntry`.
 */
export function normalizeRecord(raw: unknown): EnrichmentRecord {
  const o =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    commonName: asString(o.commonName),
    pronunciation: asString(o.pronunciation),
    nameMeaning: asString(o.nameMeaning),
    oneLiner: asString(o.oneLiner),
    description: asString(o.description),
    bodyLength: normalizeMeasurement(o.bodyLength),
    height: normalizeMeasurement(o.height),
    mass: normalizeMeasurement(o.mass),
    diet: asString(o.diet),
    era: asString(o.era),
    discovery: normalizeDiscovery(o.discovery),
    notableFacts: normalizeFacts(o.notableFacts),
  };
}

/**
 * Parse a model reply into a record. Tolerates a stray ```json fence or leading
 * prose by extracting the outermost JSON object; throws only when no JSON object
 * is present at all.
 */
export function parseRecordText(text: string): EnrichmentRecord {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found in model reply');
  }
  const json = text.slice(start, end + 1);
  return normalizeRecord(JSON.parse(json) as unknown);
}

/** The article bundle Engine B extracts from (same fields Engine A captures). */
export interface ArticleBundle {
  taxonId: string;
  taxonName: string;
  article: string;
  url: string;
  revid: number;
}

/**
 * Wrap a parsed record in the committed cache envelope, tagged `engine: 'batch'`.
 * `assertedOn` defaults to today (UTC date) so a rebuild is stable within a day.
 */
export function toCacheEntry(
  bundle: ArticleBundle,
  record: EnrichmentRecord,
  assertedOn: string = new Date().toISOString().slice(0, 10),
): EnrichmentCacheEntry {
  return {
    taxonId: bundle.taxonId,
    taxonName: bundle.taxonName,
    source: { article: bundle.article, url: bundle.url, revid: bundle.revid },
    engine: 'batch',
    assertedOn,
    record,
  };
}
