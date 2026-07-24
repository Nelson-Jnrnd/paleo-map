/**
 * Maps a taxon's major group (SPEC-010 classification) to a local clade
 * silhouette asset (SPEC-012 REQ-004). These are **generic group silhouettes**,
 * bundled with the app — never a photograph of a specific taxon — so the profile
 * always has an honest visual anchor even when no licensed image exists.
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

export interface CladeSilhouette {
  src: string;
  /** Human-readable group name for the label + alt text. */
  group: string;
}

/** Major-group clade name → bundled silhouette. Unlisted groups use `others`. */
const GROUP_TO_ASSET: Readonly<Record<string, { src: string; group: string }>> =
  {
    Theropoda: { src: theropod, group: "Theropod" },
    Coelurosauria: { src: theropod, group: "Theropod" },
    Tyrannosauroidea: { src: theropod, group: "Theropod" },
    Ornithomimosauria: { src: theropod, group: "Theropod" },
    Sauropodomorpha: { src: sauropod, group: "Sauropodomorph" },
    Sauropoda: { src: sauropod, group: "Sauropod" },
    Titanosauria: { src: sauropod, group: "Sauropod" },
    Ornithopoda: { src: ornithopod, group: "Ornithopod" },
    Hadrosauroidea: { src: ornithopod, group: "Ornithopod" },
    Thyreophora: { src: stegosaurus, group: "Armoured dinosaur" },
    Stegosauria: { src: stegosaurus, group: "Stegosaur" },
    Ankylosauria: { src: stegosaurus, group: "Armoured dinosaur" },
    Ceratopsia: { src: triceratops, group: "Ceratopsian" },
    Marginocephalia: { src: triceratops, group: "Ceratopsian" },
    Pachycephalosauria: {
      src: pachycephalosaurus,
      group: "Pachycephalosaur",
    },
  };

const FALLBACK: CladeSilhouette = { src: others, group: "Dinosaur" };

/**
 * Pick the silhouette for a taxon by resolving up its parent chain to the
 * nearest major-group clade (SPEC-010 `resolveTierTaxon`). Falls back to a
 * generic dinosaur silhouette when the group is unknown or unclassifiable.
 */
export function silhouetteForTaxon(
  taxonId: string,
  taxaById: ReadonlyMap<string, ReadTaxon>,
): CladeSilhouette {
  const group = resolveTierTaxon(taxonId, "majorGroup", taxaById);
  if (!group) return FALLBACK;
  return GROUP_TO_ASSET[group.scientificName] ?? FALLBACK;
}
