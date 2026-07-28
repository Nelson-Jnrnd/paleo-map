// @vitest-environment jsdom
/**
 * SPEC-014 REQ-003 / AMEND-002 — the taxon illustration shows a large lead image
 * with a thumbnail strip to switch it; the lead's type, credit, licence and
 * Commons link are present (revealed on hover/focus). With no images it falls
 * back to the taxon silhouette.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Illustration } from "../../src/app/components/Illustration.js";
import type { ReadImage } from "../../src/domain/index.js";
import type { CladeSilhouette } from "../../src/app/components/cladeSilhouette.js";

afterEach(cleanup);

const SILHOUETTE: CladeSilhouette = { src: "theropod.png", group: "Theropod" };

const IMAGES: ReadImage[] = [
  {
    type: "SkeletalMount",
    credit: "Museum A",
    licence: "CC BY 2.0",
    imageUrl: "data/images/a.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
    sourceId: "src:wp:Q1",
  },
  {
    type: "ArtisticReconstruction",
    credit: "Artist B",
    licence: "CC BY-SA 4.0",
    imageUrl: "data/images/b.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:B.jpg",
    sourceId: "src:wp:Q1",
  },
];

test("shows a lead image with its provenance and a thumbnail to switch (REQ-003)", async () => {
  render(
    <Illustration
      taxonName="Tyrannosaurus"
      images={IMAGES}
      silhouette={SILHOUETTE}
      phylopicSilhouette={null}
    />,
  );

  // The first image is the lead, with its credit + a Commons link present.
  expect(
    screen.getByAltText("Skeletal mount of Tyrannosaurus"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Museum A/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /commons/i })).toBeInTheDocument();

  // The second image is offered as a thumbnail; clicking it swaps the lead.
  const thumb = screen.getByRole("button", {
    name: /Show Artistic reconstruction/i,
  });
  await userEvent.setup().click(thumb);
  expect(
    screen.getByAltText("Artistic reconstruction of Tyrannosaurus"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Artist B/)).toBeInTheDocument();

  // No silhouette when real images exist.
  expect(
    screen.queryByAltText(/Generic .* silhouette/i),
  ).not.toBeInTheDocument();
});

test("falls back to the silhouette when there are no images (REQ-004)", () => {
  render(
    <Illustration
      taxonName="Obscurus"
      images={[]}
      silhouette={SILHOUETTE}
      phylopicSilhouette={null}
    />,
  );
  expect(
    screen.getByAltText("Generic Theropod silhouette"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /commons/i }),
  ).not.toBeInTheDocument();
});
