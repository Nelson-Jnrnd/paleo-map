// @vitest-environment jsdom
/**
 * SPEC-012 REQ-003/004/005 — taxon-profile illustration. A taxon with a showable
 * image shows it with type, credit, licence, a Commons source link and alt text,
 * plus a human-relative size scale when a body length exists. A taxon with no
 * showable image falls back to a clearly-labelled generic clade silhouette.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaxonProfile } from "../../src/app/components/TaxonProfile.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("shows the licensed lead image with provenance + a size scale (REQ-003/005)", async () => {
  const api = await fixtureApi();
  render(
    <TaxonProfile api={api} taxonId="txn:tyrannosaurus" onBack={() => {}} onOpenTaxon={() => {}} />,
  );

  // The image renders with descriptive alt text and the renderable URL.
  const img = screen.getByAltText("Artistic reconstruction of Tyrannosaurus");
  expect(img.getAttribute("src")).toContain("Trex.jpg");

  // Provenance is visible alongside the image (not behind a hover).
  expect(screen.getByText(/Jane Doe \(artist\)/)).toBeInTheDocument();
  expect(screen.getByText(/CC BY-SA 4\.0/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /commons/i })).toHaveAttribute(
    "href",
    "https://commons.wikimedia.org/wiki/File:Trex.jpg",
  );

  // Size scale from BodyLength (12.3 m), conveyed via a labelled figure.
  expect(
    screen.getByRole("img", { name: /about 12\.3 metres long/i }),
  ).toBeInTheDocument();
});

test("falls back to a labelled generic clade silhouette when no image is showable (REQ-004)", async () => {
  const api = await fixtureApi();
  render(
    <TaxonProfile api={api} taxonId="txn:nanotyrannus" onBack={() => {}} onOpenTaxon={() => {}} />,
  );

  // Nanotyrannus (a tyrannosaurid) has no showable image → theropod silhouette.
  expect(
    screen.getByAltText(/Generic Theropod silhouette/i),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/not a photograph of this taxon/i),
  ).toBeInTheDocument();

  // No licensed-image source link, and no size scale (no body length recorded).
  expect(
    screen.queryByRole("link", { name: /commons/i }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Size vs human/i)).not.toBeInTheDocument();
});
