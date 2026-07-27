// @vitest-environment jsdom
/**
 * SPEC-014 REQ-003 — the taxon illustration renders a *gallery* of showable
 * images (each with its own type, credit, licence and Commons link), not just a
 * single lead image; with no images it falls back to the clade silhouette.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

test("renders every showable image with its own provenance (REQ-003)", () => {
  render(
    <Illustration
      taxonName="Tyrannosaurus"
      images={IMAGES}
      silhouette={SILHOUETTE}
      phylopicSilhouette={null}
      bodyLengthM={null}
    />,
  );

  expect(
    screen.getByAltText("Skeletal mount of Tyrannosaurus"),
  ).toBeInTheDocument();
  expect(
    screen.getByAltText("Artistic reconstruction of Tyrannosaurus"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Museum A/)).toBeInTheDocument();
  expect(screen.getByText(/Artist B/)).toBeInTheDocument();
  // One Commons source link per image.
  expect(screen.getAllByRole("link", { name: /commons/i })).toHaveLength(2);
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
      bodyLengthM={null}
    />,
  );
  expect(
    screen.getByAltText("Generic Theropod silhouette"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /commons/i }),
  ).not.toBeInTheDocument();
});
