/**
 * LLM enrichment record (SPEC-014 REQ-001/002). A per-genus, extract-don't-invent
 * record distilled from the taxon's Wikipedia article at a pinned revision. Every
 * fact is nullable and `null` when the article does not state it — never invented
 * (NFR-002). Numeric measurements carry a unit, an optional low–high range, and a
 * `stated | estimated` confidence.
 *
 * The record is content only. Its provenance (source article + `revid` + which
 * engine wrote it) lives on the cache envelope (see `pipeline/enrichment.ts`), so
 * the same record shape is produced identically by the agent-authored engine and
 * the optional batch-script engine — the cache is the contract.
 */

/** How firmly the article backs a number. */
export type EnrichmentConfidence = 'stated' | 'estimated';

/** A measurement extracted from the article: value + unit + optional range. */
export interface EnrichedMeasurement {
  value: number;
  /** Unit the value/range are in (e.g. "m", "kg", "t"). */
  unit: string;
  /** Range low, or null when the article gives a single figure. */
  low: number | null;
  /** Range high, or null when the article gives a single figure. */
  high: number | null;
  confidence: EnrichmentConfidence;
}

/** Where/when/by whom the taxon was discovered or named (each field nullable). */
export interface EnrichmentDiscovery {
  year: number | null;
  who: string | null;
  where: string | null;
}

/** A short, tagged fact worth surfacing (SPEC-014 REQ-001: 2–4 per taxon). */
export interface EnrichmentFact {
  /** A one-word category, e.g. "size", "speed", "diet", "discovery", "behaviour". */
  tag: string;
  text: string;
}

/**
 * The extraction schema (SPEC-014 REQ-001). All fields nullable; arrays may be
 * empty. Populated for genera with a Wikipedia article; absent facts are `null`.
 */
export interface EnrichmentRecord {
  /** Vernacular name if the article gives one (e.g. "tyrant lizard"). */
  commonName: string | null;
  /** Rough phonetic guide, e.g. "tie-RAN-oh-SORE-us". */
  pronunciation: string | null;
  /** What the name means, e.g. "tyrant lizard". */
  nameMeaning: string | null;
  /** One line: what this animal was, e.g. "A large predatory theropod." */
  oneLiner: string | null;
  /** Plain-language description, 2–4 sentences. */
  description: string | null;
  bodyLength: EnrichedMeasurement | null;
  height: EnrichedMeasurement | null;
  mass: EnrichedMeasurement | null;
  /** Diet in the article's terms; cross-checked against PBDB at build time. */
  diet: string | null;
  /** Era/period context sentence, e.g. "Late Cretaceous, ~68–66 Ma." */
  era: string | null;
  discovery: EnrichmentDiscovery | null;
  /** 2–4 tagged notable facts; empty when the article supports none. */
  notableFacts: EnrichmentFact[];
}
