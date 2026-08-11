/**
 * Shared fixture tree for the SPEC-019 unit tests. Mirrors the real snapshot's
 * shape around *Tyrannosaurus* (the spec's worked example) closely enough that
 * the assertions read as real classification, while staying small enough to
 * reason about: a deep theropod trunk, three sibling divisions off the root, an
 * avian branch, a genus hanging directly off `Dinosauria`, a junior synonym, and
 * a taxon outside the scope root.
 *
 * Not a `.test.ts`, so Vitest does not collect it.
 */

import type {
  ReadModel,
  ReadProfile,
  ReadTaxon,
  TimeRange,
} from "../src/domain/index.js";
import { buildTaxonomyIndex } from "../src/app/state/taxonomy.js";
import { buildGameData } from "../src/app/state/dailyGenus.js";
import type { GameData } from "../src/app/state/dailyGenus.js";

export function taxon(
  id: string,
  scientificName: string,
  rank: string,
  parentId: string | null,
  validity: string = "Valid",
): ReadTaxon {
  return {
    id,
    scientificName,
    rank,
    ...(parentId ? { parentId } : {}),
    validity: { value: validity, sourceId: "src:1", editorial: false, provenance: {} },
    acceptedPer: `${scientificName} Author, 1900`,
  } as unknown as ReadTaxon;
}

export const FIXTURE_TAXA: ReadTaxon[] = [
  // Outside the scope root — reachable by name, never guessable.
  taxon("t:arch", "Archosauria", "Clade", null),
  taxon("t:mammal", "Smilodon", "Genus", null),

  taxon("t:dino", "Dinosauria", "Clade", "t:arch"),

  taxon("t:thero", "Theropoda", "Clade", "t:dino"),
  taxon("t:coel", "Coelurosauria", "Clade", "t:thero"),
  taxon("t:tyrid", "Tyrannosauridae", "Family", "t:coel"),
  taxon("t:tyrinae", "Tyrannosaurinae", "Clade", "t:tyrid"),
  taxon("t:trex", "Tyrannosaurus", "Genus", "t:tyrinae"),
  taxon("t:albsub", "Albertosaurinae", "Clade", "t:tyrid"),
  taxon("t:gorgo", "Gorgosaurus", "Genus", "t:albsub"),
  taxon("t:manir", "Maniraptora", "Clade", "t:coel"),
  taxon("t:veloci", "Velociraptor", "Genus", "t:manir"),
  // A junior synonym: in the snapshot, but not `Valid`.
  taxon("t:antro", "Antrodemus", "Genus", "t:thero", "Synonymous"),

  taxon("t:saur", "Saurischia", "Clade", "t:dino"),
  taxon("t:diplo", "Diplodocus", "Genus", "t:saur"),

  taxon("t:orni", "Ornithischia", "Clade", "t:dino"),
  taxon("t:trike", "Triceratops", "Genus", "t:orni"),

  // Birds are dinosaurs — structurally in scope, excluded from the game.
  taxon("t:avialae", "Avialae", "Clade", "t:dino"),
  taxon("t:archaeo", "Archaeopteryx", "Genus", "t:avialae"),

  // A genus hanging directly off the root: the depth-1 edge case.
  taxon("t:nyasa", "Nyasasaurus", "Genus", "t:dino"),
];

const span = (maxMa: number, minMa: number): TimeRange => ({ maxMa, minMa });

/** Time spans chosen so the clue has all three verdicts among the fixtures. */
export const FIXTURE_SPANS: Readonly<Record<string, TimeRange | null>> = {
  "t:trex": span(83.6, 66),
  "t:gorgo": span(83.6, 66),
  "t:veloci": span(100.5, 66),
  "t:diplo": span(157.9, 143.1),
  "t:trike": span(83.6, 66),
  "t:nyasa": span(247.2, 242),
  "t:archaeo": span(152, 148),
  "t:antro": span(157, 145),
};

/**
 * Filler genera so a rendered screen clears `MIN_POOL_SIZE` and exercises the
 * real pool path rather than the degraded-pool error state. They hang off their
 * own clade, so the *Tyrannosaurus* scenario above is untouched.
 */
export function paddingTaxa(count: number): ReadTaxon[] {
  const out: ReadTaxon[] = [taxon("t:filler", "Fillerosauria", "Clade", "t:dino")];
  for (let i = 0; i < count; i++) {
    out.push(taxon(`t:fill${i}`, `Fillerosaurus${i}`, "Genus", "t:filler"));
  }
  return out;
}

export interface ProfileOptions {
  /** Genera deliberately left out of the answer pool, by id. */
  readonly noImage?: readonly string[];
  readonly noSummary?: readonly string[];
  readonly noSilhouette?: readonly string[];
  readonly noSpan?: readonly string[];
}

export function fixtureProfiles(options: ProfileOptions = {}): ReadProfile[] {
  const has = (list: readonly string[] | undefined, id: string): boolean =>
    Boolean(list?.includes(id));
  return FIXTURE_TAXA.map(
    (t) =>
      ({
        taxonId: t.id,
        contentLevel: "DetailedProfile",
        summary: has(options.noSummary, t.id)
          ? null
          : { value: `About ${t.scientificName}.`, sourceId: "src:wp", editorial: false, provenance: {} },
        commonName: null,
        attributes: [],
        measurements: [],
        images: has(options.noImage, t.id)
          ? []
          : [
              {
                type: "ArtisticReconstruction",
                credit: "Someone",
                licence: "CC BY 4.0",
                imageUrl: `data/images/${t.id}.png`,
                sourceUrl: "https://example.invalid",
                sourceId: "src:wp",
              },
            ],
        enrichment: null,
        silhouette: has(options.noSilhouette, t.id) ? null : `data/sil/${t.id}.svg`,
        occurrenceCount: 4,
        timeSpan: has(options.noSpan, t.id) ? null : (FIXTURE_SPANS[t.id] ?? span(150, 100)),
        timeSpanApproximate: false,
      }) as unknown as ReadProfile,
  );
}

export function fixtureModel(options: ProfileOptions = {}): ReadModel {
  return {
    metadata: { retrievedOn: "2026-07-26" },
    taxa: FIXTURE_TAXA,
    profiles: fixtureProfiles(options),
    occurrences: [],
    sources: {},
  } as unknown as ReadModel;
}

export function fixtureGameData(options: ProfileOptions = {}): GameData {
  const model = fixtureModel(options);
  const byId = new Map(model.profiles.map((p) => [p.taxonId, p]));
  return buildGameData(model.taxa, buildTaxonomyIndex(model.taxa), (id) => byId.get(id));
}

/** Look up a fixture taxon by name — keeps the tests readable. */
export function named(data: GameData, name: string): { id: string } {
  const found = data.guessable.find((t) => t.scientificName === name);
  if (!found) throw new Error(`fixture: ${name} is not guessable`);
  return found;
}
