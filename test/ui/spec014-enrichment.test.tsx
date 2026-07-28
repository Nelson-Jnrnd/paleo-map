// @vitest-environment jsdom
/**
 * SPEC-014 REQ-005 / AMEND-002 — the "About" block surfaces the enrichment as
 * reading content: the plain-language blurb, notable facts as quiet prose (no tag
 * chips), and a collapsible "Discovery & naming". The one-liner now leads the
 * identity header and the numeric facts live in the spec table, so they are not
 * this block's concern. Missing fields are omitted, not invented.
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
  description:
    "It ranged across western North America at the end of the Cretaceous.",
  bodyLength: {
    value: 12.4,
    unit: "m",
    low: 12.3,
    high: 13,
    confidence: "estimated",
  },
  height: null,
  mass: {
    value: 8.8,
    unit: "t",
    low: null,
    high: null,
    confidence: "estimated",
  },
  diet: "Carnivore",
  era: "Late Cretaceous, ~69–66 Ma",
  discovery: { year: 1905, who: "H. F. Osborn", where: null },
  notableFacts: [{ tag: "bite", text: "Strongest bite of any land animal." }],
};

test("renders the blurb and notable facts as prose (no tag chips)", () => {
  render(<TaxonEnrichment enrichment={RECORD} />);
  expect(screen.getByText(/end of the Cretaceous/)).toBeTruthy();
  expect(screen.getByText("Strongest bite of any land animal.")).toBeTruthy();
  // The notable-fact tag word is not rendered as a chip.
  expect(screen.queryByText("bite")).toBeNull();
});

test("collapsible discovery & naming is present", () => {
  render(<TaxonEnrichment enrichment={RECORD} />);
  expect(screen.getByText("Discovery & naming")).toBeTruthy();
  expect(screen.getByText(/1905/)).toBeTruthy();
  expect(screen.getByText("tyrant lizard")).toBeTruthy();
});

test("a sparse record renders the heading only (extract-don't-invent)", () => {
  const sparse: EnrichmentRecord = {
    commonName: null,
    pronunciation: null,
    nameMeaning: null,
    oneLiner: null,
    description: null,
    bodyLength: null,
    height: null,
    mass: null,
    diet: null,
    era: null,
    discovery: null,
    notableFacts: [],
  };
  render(<TaxonEnrichment enrichment={sparse} />);
  expect(screen.getByText("About")).toBeTruthy();
  expect(screen.queryByText("Discovery & naming")).toBeNull();
});
