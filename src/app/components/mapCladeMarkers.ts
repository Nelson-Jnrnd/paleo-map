/**
 * Clade markers for the occurrence map (SPEC-015 REQ-001). Maps a taxon's major
 * group to a **bundled clade silhouette icon** plus a **muted, meaning-only clade
 * tint**. Identity is carried by the silhouette *shape* first; the tint is a
 * reinforcing second cue (charter: never colour alone). The set is bounded (one
 * entry per major group), so the map registers a fixed handful of images
 * regardless of taxon count, and stays fully offline (the assets are bundled).
 *
 * The group→icon mapping mirrors `cladeSilhouette.ts` (the profile's clade
 * silhouettes) so the map and the taxon page speak the same visual language.
 */

import type { ReadTaxon } from "../../domain/index.js";
import { resolveTierTaxon } from "../state/grouping.js";
import theropod from "../assets/clades/theropod.png";
import sauropod from "../assets/clades/sauropod.png";
import ornithopod from "../assets/clades/ornithopod.png";
import stegosaurus from "../assets/clades/stegosaurus.png";
import triceratops from "../assets/clades/triceratops.png";
import pachycephalosaurus from "../assets/clades/pachycephalosaurus.png";
import others from "../assets/clades/others.png";

export interface CladeMarker {
  /** Stable id, used as the MapLibre image name + legend key. */
  id: string;
  /** Human-readable clade label (legend + hover + alt text). */
  label: string;
  /** Bundled silhouette asset URL. */
  src: string;
  /** Muted, meaning-only tint reinforcing the shape (charter §4). */
  tint: string;
}

/** The bounded clade marker set (one per major group + a neutral fallback). */
// Pale, muted clade tints: light enough that the dark silhouette always reads on
// the coin, distinct enough to scan (shape stays the primary cue; REQ-001).
export const CLADE_MARKERS: readonly CladeMarker[] = [
  { id: "theropod", label: "Theropod", src: theropod, tint: "#dc9a80" },
  { id: "sauropod", label: "Sauropod", src: sauropod, tint: "#82b6a7" },
  { id: "ornithopod", label: "Ornithopod", src: ornithopod, tint: "#93a9cc" },
  {
    id: "thyreophoran",
    label: "Thyreophoran",
    src: stegosaurus,
    tint: "#cbbd7f",
  },
  {
    id: "ceratopsian",
    label: "Ceratopsian",
    src: triceratops,
    tint: "#c893ad",
  },
  {
    id: "pachycephalosaur",
    label: "Pachycephalosaur",
    src: pachycephalosaurus,
    tint: "#aa9cc8",
  },
  { id: "other", label: "Dinosaur", src: others, tint: "#b4bcc6" },
];

const BY_ID: Readonly<Record<string, CladeMarker>> = Object.fromEntries(
  CLADE_MARKERS.map((m) => [m.id, m]),
);

/** Major-group clade name → marker id (mirrors cladeSilhouette's GROUP_TO_ASSET). */
const GROUP_TO_ID: Readonly<Record<string, string>> = {
  Theropoda: "theropod",
  Coelurosauria: "theropod",
  Tyrannosauroidea: "theropod",
  Ornithomimosauria: "theropod",
  Sauropodomorpha: "sauropod",
  Sauropoda: "sauropod",
  Titanosauria: "sauropod",
  Ornithopoda: "ornithopod",
  Hadrosauroidea: "ornithopod",
  Thyreophora: "thyreophoran",
  Stegosauria: "thyreophoran",
  Ankylosauria: "thyreophoran",
  Ceratopsia: "ceratopsian",
  Marginocephalia: "ceratopsian",
  Pachycephalosauria: "pachycephalosaur",
};

/** The neutral fallback marker (unresolved / unclassifiable group). */
export const FALLBACK_MARKER: CladeMarker = BY_ID["other"]!;

/**
 * Pick the clade marker for a taxon by resolving up its parent chain to the
 * nearest major-group clade (SPEC-010 `resolveTierTaxon`). Falls back to the
 * neutral marker when the group is unknown.
 */
export function cladeMarkerForTaxon(
  taxonId: string,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): CladeMarker {
  const group = resolveTierTaxon(taxonId, "majorGroup", taxaById);
  if (!group) return FALLBACK_MARKER;
  return BY_ID[GROUP_TO_ID[group.scientificName] ?? "other"] ?? FALLBACK_MARKER;
}
