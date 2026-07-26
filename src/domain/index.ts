/**
 * Shared domain model (SPEC-001). Expressed once in TypeScript and imported by
 * both the ingestion pipeline and the app (SPEC-002 REQ-002) so the two cannot
 * drift.
 */

export * from './provenance.js';
export * from './taxonomy.js';
export * from './occurrence.js';
export * from './timescale.js';
export * from './profile.js';
export * from './enrichment.js';
export * from './snapshot.js';
