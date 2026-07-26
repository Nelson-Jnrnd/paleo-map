// @vitest-environment jsdom
/**
 * SPEC-014 REQ-005 — the taxon page surfaces the AI-assisted enrichment: a
 * one-liner, a fact row (length/mass/diet/era) with an explicit `est.` cue for
 * estimated numbers, a plain-language blurb, collapsible discovery/notable facts,
 * and a one-line AI disclosure (NFR-002). Missing facts are omitted, not invented.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaxonEnrichment } from "../../src/app/components/TaxonEnrichment.js";
import type { EnrichmentRecord } from "../../src/domain/index.js";

afterEach(cleanup);

const RECORD: EnrichmentRecord = {
  commonName: null,
  pronunciation: "tie-RAN-oh-SORE-us",
  nameMeaning: "tyrant lizard",
  oneLiner: "A giant bipedal carnivorous theropod.",
  description: "It ranged across western North America at the end of the Cretaceous.",
  bodyLength: { value: 12.4, unit: "m", low: 12.3, high: 13, confidence: "estimated" },
  height: null,
  mass: { value: 8.8, unit: "t", low: null, high: null, confidence: "estimated" },
  diet: "Carnivore",
  era: "Late Cretaceous, ~69–66 Ma",
  discovery: { year: 1905, who: "H. F. Osborn", where: null },
  notableFacts: [{ tag: "bite", text: "Strongest bite of any land animal." }],
};

test("renders the one-liner, blurb and AI disclosure", () => {
  render(<TaxonEnrichment enrichment={RECORD} />);
  expect(screen.getByText("A giant bipedal carnivorous theropod.")).toBeTruthy();
  expect(screen.getByText(/end of the Cretaceous/)).toBeTruthy();
  expect(screen.getByText(/AI-assisted/)).toBeTruthy();
});

test("shows present facts with units + an estimated cue, omits missing ones", () => {
  render(<TaxonEnrichment enrichment={RECORD} />);
  // Length chip: value + range, with the est. marker for estimated numbers.
  expect(screen.getByText(/12.4 m · 12.3–13/)).toBeTruthy();
  expect(screen.getAllByText(/est\./).length).toBeGreaterThan(0);
  expect(screen.getByText("Carnivore")).toBeTruthy();
  // Height is null → no "Height" chip is rendered.
  expect(screen.queryByText("Height")).toBeNull();
});

test("collapsible discovery + notable facts are present", () => {
  render(<TaxonEnrichment enrichment={RECORD} />);
  expect(screen.getByText("Discovery & naming")).toBeTruthy();
  expect(screen.getByText(/1905/)).toBeTruthy();
  expect(screen.getByText("Notable facts (1)")).toBeTruthy();
  expect(screen.getByText("Strongest bite of any land animal.")).toBeTruthy();
});

test("a sparse record renders only what is present (extract-don't-invent)", () => {
  const sparse: EnrichmentRecord = {
    commonName: null, pronunciation: null, nameMeaning: null, oneLiner: null,
    description: null, bodyLength: null, height: null, mass: null, diet: null,
    era: null, discovery: null, notableFacts: [],
  };
  render(<TaxonEnrichment enrichment={sparse} />);
  // No fact chips, no collapsibles — but the disclosure still appears.
  expect(screen.queryByText("Length")).toBeNull();
  expect(screen.queryByText("Discovery & naming")).toBeNull();
  expect(screen.getByText(/AI-assisted/)).toBeTruthy();
});
