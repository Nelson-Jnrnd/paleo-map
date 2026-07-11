/**
 * A small, hand-captured Dinosauria subset for one time window (Late Cretaceous,
 * Campanian–Maastrichtian). It stands in for a real PBDB `occs`/`taxa`/`opinions`
 * pull joined to a Wikidata SPARQL result and a Wikipedia summary snapshot. It is
 * deliberately shaped to exercise every SPEC-001 requirement:
 *
 *  - Nanotyrannus has two competing opinions (Valid → Synonymous) so the winning
 *    opinion is derived, and is unmatched on Wikidata (no encyclopedic content).
 *  - One collection spans two stages (approximate); one lacks paleocoordinates
 *    (missing); the rest are single-stage with paleocoordinates (reconstructed).
 *  - Attributes come via primary, encyclopedic, and editorial sources.
 *  - One measurement is fully null (missing); the others carry bounds + a source.
 *  - One image lacks a licence (dropped to fallback); the others are showable.
 *
 * `retrievedOn` is fixed (a capture date), not `Date.now()`, so an L2 rebuild is
 * deterministic (NFR-001).
 */

import type { SourceSubset } from '../pipeline/sources.js';

export const DINOSAURIA_MAASTRICHTIAN: SourceSubset = {
  metadata: {
    retrievedOn: '2026-07-01',
    rotationModel: 'scotese',
    rotationModelVersion: 'PALEOMAP-2016',
    pbdbSubset: 'Dinosauria occurrences, Campanian–Maastrichtian (Late Cretaceous)',
    timeWindow: { name: 'Campanian–Maastrichtian', maxMa: 83.6, minMa: 66.0 },
  },

  references: [
    { id: 'ref:osborn1905', reference: 'Osborn, H.F. 1905. Tyrannosaurus and other Cretaceous carnivorous dinosaurs.', url: 'https://example.org/osborn1905', pubYear: 1905 },
    { id: 'ref:marsh1889', reference: 'Marsh, O.C. 1889. Notice of new American Dinosauria (Triceratops).', url: 'https://example.org/marsh1889', pubYear: 1889 },
    { id: 'ref:bakker1988', reference: 'Bakker, R.T. et al. 1988. Nanotyrannus, a new genus of pygmy tyrannosaur.', url: 'https://example.org/bakker1988', pubYear: 1988 },
    { id: 'ref:carr2020', reference: 'Carr, T.D. 2020. A high-resolution growth series of Tyrannosaurus rex.', url: 'https://example.org/carr2020', pubYear: 2020 },
    { id: 'ref:coll-hellcreek', reference: 'PBDB collection reference — Hell Creek Formation localities.', pubYear: 2011 },
  ],

  taxa: [
    { id: 'txn:tyrannosaurus', name: 'Tyrannosaurus', rank: 'Genus', parentId: 'txn:tyrannosauridae' },
    { id: 'txn:triceratops', name: 'Triceratops', rank: 'Genus', parentId: 'txn:ceratopsidae' },
    { id: 'txn:nanotyrannus', name: 'Nanotyrannus', rank: 'Genus', parentId: 'txn:tyrannosauridae' },
  ],

  opinions: [
    { taxonId: 'txn:tyrannosaurus', status: 'Valid', publishedOn: '1905-01-01', referenceId: 'ref:osborn1905' },
    { taxonId: 'txn:triceratops', status: 'Valid', publishedOn: '1889-01-01', referenceId: 'ref:marsh1889' },
    // Two competing opinions — the more recent (Synonymous) wins.
    { taxonId: 'txn:nanotyrannus', status: 'Valid', publishedOn: '1988-01-01', referenceId: 'ref:bakker1988' },
    { taxonId: 'txn:nanotyrannus', status: 'Synonymous', publishedOn: '2020-01-01', referenceId: 'ref:carr2020' },
  ],

  collections: [
    {
      id: 'col:hellcreek1', name: 'Hell Creek — Montana locality A',
      formation: 'Hell Creek Formation', member: null,
      lat: 47.1, lng: -106.8, region: 'Montana, USA',
      palaeoLat: 55.2, palaeoLng: -75.4, // reconstructed (scotese)
      maxMa: 68.0, minMa: 66.5, // Maastrichtian only → not approximate
      referenceId: 'ref:coll-hellcreek',
    },
    {
      id: 'col:hellcreek2', name: 'Hell Creek — Montana locality B',
      formation: 'Hell Creek Formation', member: null,
      lat: 47.4, lng: -106.4, region: 'Montana, USA',
      palaeoLat: 55.5, palaeoLng: -74.9,
      maxMa: 67.0, minMa: 66.2,
      referenceId: 'ref:coll-hellcreek',
    },
    {
      id: 'col:spanning', name: 'Judith River — Campanian–Maastrichtian locality',
      formation: 'Judith River Formation', member: null,
      lat: 47.9, lng: -108.7, region: 'Montana, USA',
      palaeoLat: 56.0, palaeoLng: -76.0,
      maxMa: 74.0, minMa: 70.0, // spans Campanian + Maastrichtian → approximate
      referenceId: 'ref:coll-hellcreek',
    },
    {
      id: 'col:nopaleo', name: 'Lance — locality without paleocoordinates',
      formation: 'Lance Formation', member: null,
      lat: 43.5, lng: -104.7, region: 'Wyoming, USA',
      palaeoLat: null, palaeoLng: null, // missing paleoposition
      maxMa: 68.0, minMa: 66.4,
      referenceId: 'ref:coll-hellcreek',
    },
  ],

  occurrences: [
    { id: 'occ:1', collectionId: 'col:hellcreek1', taxonId: 'txn:tyrannosaurus', taxonAsRecorded: 'Tyrannosaurus rex', reidentified: false, referenceId: 'ref:coll-hellcreek' },
    { id: 'occ:2', collectionId: 'col:hellcreek1', taxonId: 'txn:triceratops', taxonAsRecorded: 'Triceratops horridus', reidentified: false, referenceId: 'ref:coll-hellcreek' },
    { id: 'occ:3', collectionId: 'col:spanning', taxonId: 'txn:tyrannosaurus', taxonAsRecorded: 'Tyrannosaurus sp.', reidentified: false, referenceId: 'ref:coll-hellcreek' },
    { id: 'occ:4', collectionId: 'col:hellcreek2', taxonId: 'txn:nanotyrannus', taxonAsRecorded: 'Nanotyrannus lancensis', reidentified: true, referenceId: 'ref:coll-hellcreek' },
    { id: 'occ:5', collectionId: 'col:nopaleo', taxonId: 'txn:triceratops', taxonAsRecorded: 'Triceratops sp.', reidentified: false, referenceId: 'ref:coll-hellcreek' },
  ],

  measurements: [
    { taxonId: 'txn:tyrannosaurus', kind: 'BodyLength', value: 12.3, unit: 'm', lowerBound: 11.1, upperBound: 12.8, referenceId: 'ref:carr2020', publishedOn: '2020-01-01' },
    { taxonId: 'txn:tyrannosaurus', kind: 'BodyMass', value: 8400, unit: 'kg', lowerBound: 6000, upperBound: 9000, referenceId: 'ref:carr2020', publishedOn: '2020-01-01' },
    { taxonId: 'txn:triceratops', kind: 'BodyLength', value: 8.0, unit: 'm', lowerBound: 7.5, upperBound: 9.0, referenceId: 'ref:marsh1889', publishedOn: '1889-01-01' },
    // Fully null → renders as an explicit "not available" (missing flag).
    { taxonId: 'txn:triceratops', kind: 'BodyMass', value: null, unit: 'kg', lowerBound: null, upperBound: null, referenceId: 'ref:marsh1889', publishedOn: '1889-01-01' },
  ],

  attributes: [
    // Primary (PBDB reference) → not interpretative.
    { taxonId: 'txn:triceratops', kind: 'Diet', value: 'Herbivore', assertedOn: '1889-01-01', source: { via: 'reference', referenceId: 'ref:marsh1889' } },
    // Encyclopedic (Wikipedia) → interpretative.
    { taxonId: 'txn:tyrannosaurus', kind: 'Locomotion', value: 'Bipedal', assertedOn: '2026-07-01', source: { via: 'encyclopedic', qid: 'Q14332' } },
    // Editorial synthesis → interpretative.
    { taxonId: 'txn:tyrannosaurus', kind: 'Diet', value: 'Carnivore', assertedOn: '2026-07-01', source: { via: 'editorial' } },
  ],

  wikidata: [
    { qid: 'Q14332', pbdbTaxonId: 'txn:tyrannosaurus', enwikiTitle: 'Tyrannosaurus', enwikiUrl: 'https://en.wikipedia.org/wiki/Tyrannosaurus', commonName: 'Tyrant lizard' },
    { qid: 'Q14384', pbdbTaxonId: 'txn:triceratops', enwikiTitle: 'Triceratops', enwikiUrl: 'https://en.wikipedia.org/wiki/Triceratops', commonName: 'Three-horned face' },
    // Nanotyrannus: no Wikidata binding → no encyclopedic content (degrades gracefully).
  ],

  wikipedia: [
    { qid: 'Q14332', extract: 'Tyrannosaurus is a genus of large theropod dinosaur.', url: 'https://en.wikipedia.org/wiki/Tyrannosaurus' },
    { qid: 'Q14384', extract: 'Triceratops is a genus of herbivorous ceratopsid dinosaur.', url: 'https://en.wikipedia.org/wiki/Triceratops' },
  ],

  images: [
    { taxonId: 'txn:tyrannosaurus', type: 'ArtisticReconstruction', credit: 'Jane Doe (artist)', licence: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Trex.jpg' },
    // No licence → cannot be honoured → dropped to the image-fallback state.
    { taxonId: 'txn:tyrannosaurus', type: 'FossilPhoto', credit: 'Unknown', licence: null, sourceUrl: 'https://commons.wikimedia.org/wiki/File:Trex-skull.jpg' },
    { taxonId: 'txn:triceratops', type: 'SkeletalMount', credit: 'Natural History Museum', licence: 'CC BY 2.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Triceratops-mount.jpg' },
  ],

  editorial: [
    { taxonId: 'txn:tyrannosaurus', text: 'Featured species: the archetypal apex predator of the latest Cretaceous of North America.', derivedFromUrl: 'https://en.wikipedia.org/wiki/Tyrannosaurus' },
  ],
};
