/**
 * A small, hand-captured multi-period Dinosauria subset spanning the whole
 * Mesozoic (SPEC-008 test plan). It stands in for the full-Mesozoic PBDB pull and
 * is deliberately shaped to exercise SPEC-008:
 *
 *  - One Triassic (Plateosaurus, Norian), one Jurassic (Allosaurus,
 *    Kimmeridgian), and two Cretaceous (Tyrannosaurus, Triceratops) genera, so
 *    the partition covers all three periods.
 *  - One occurrence straddles the Campanian–Maastrichtian boundary (approximate;
 *    appears in both stages' partitions, keyed by id).
 *
 * `retrievedOn` is fixed so an L2 rebuild — and every derived partition — is
 * deterministic (NFR-002).
 */

import type { SourceSubset } from '../pipeline/sources.js';

export const DINOSAURIA_MESOZOIC: SourceSubset = {
  metadata: {
    retrievedOn: '2026-07-21',
    rotationModel: 'scotese',
    rotationModelVersion: 'PALEOMAP-2016',
    pbdbSubset: 'Dinosauria occurrences, Mesozoic (Triassic–Cretaceous)',
    timeWindow: { name: 'Mesozoic', maxMa: 251.902, minMa: 66.0 },
  },

  references: [
    { id: 'ref:vonmeyer1837', reference: 'von Meyer, H. 1837. Plateosaurus.', pubYear: 1837 },
    { id: 'ref:marsh1877', reference: 'Marsh, O.C. 1877. Allosaurus.', pubYear: 1877 },
    { id: 'ref:osborn1905', reference: 'Osborn, H.F. 1905. Tyrannosaurus.', pubYear: 1905 },
    { id: 'ref:marsh1889', reference: 'Marsh, O.C. 1889. Triceratops.', pubYear: 1889 },
    { id: 'ref:coll-tri', reference: 'PBDB collection reference — Trossingen (Triassic).', pubYear: 2011 },
    { id: 'ref:coll-jur', reference: 'PBDB collection reference — Morrison (Jurassic).', pubYear: 2011 },
    { id: 'ref:coll-cre', reference: 'PBDB collection reference — Hell Creek (Cretaceous).', pubYear: 2011 },
  ],

  taxa: [
    // Genera (occurrence-bearing) with a full Genus → Family → Major-group clade →
    // Dinosauria chain (SPEC-010 DATA-002/003) so Taxon-mode rank roll-up resolves.
    { id: 'txn:plateosaurus', name: 'Plateosaurus', rank: 'Genus', parentId: 'txn:plateosauridae' },
    { id: 'txn:allosaurus', name: 'Allosaurus', rank: 'Genus', parentId: 'txn:allosauridae' },
    { id: 'txn:tyrannosaurus', name: 'Tyrannosaurus', rank: 'Genus', parentId: 'txn:tyrannosauridae' },
    { id: 'txn:triceratops', name: 'Triceratops', rank: 'Genus', parentId: 'txn:ceratopsidae' },
    { id: 'txn:plateosauridae', name: 'Plateosauridae', rank: 'Family', parentId: 'txn:sauropodomorpha' },
    { id: 'txn:allosauridae', name: 'Allosauridae', rank: 'Family', parentId: 'txn:theropoda' },
    { id: 'txn:tyrannosauridae', name: 'Tyrannosauridae', rank: 'Family', parentId: 'txn:theropoda' },
    { id: 'txn:ceratopsidae', name: 'Ceratopsidae', rank: 'Family', parentId: 'txn:ceratopsia' },
    { id: 'txn:sauropodomorpha', name: 'Sauropodomorpha', rank: 'Clade', parentId: 'txn:dinosauria' },
    { id: 'txn:theropoda', name: 'Theropoda', rank: 'Clade', parentId: 'txn:dinosauria' },
    { id: 'txn:ceratopsia', name: 'Ceratopsia', rank: 'Clade', parentId: 'txn:dinosauria' },
    { id: 'txn:dinosauria', name: 'Dinosauria', rank: 'Clade' },
  ],

  opinions: [
    { taxonId: 'txn:plateosaurus', status: 'Valid', publishedOn: '1837-01-01', referenceId: 'ref:vonmeyer1837' },
    { taxonId: 'txn:allosaurus', status: 'Valid', publishedOn: '1877-01-01', referenceId: 'ref:marsh1877' },
    { taxonId: 'txn:tyrannosaurus', status: 'Valid', publishedOn: '1905-01-01', referenceId: 'ref:osborn1905' },
    { taxonId: 'txn:triceratops', status: 'Valid', publishedOn: '1889-01-01', referenceId: 'ref:marsh1889' },
  ],

  collections: [
    {
      id: 'col:tri', name: 'Trossingen — Norian locality',
      formation: 'Löwenstein Formation', member: null,
      lat: 48.1, lng: 8.6, region: 'Baden-Württemberg, DE',
      palaeoLat: 40.2, palaeoLng: 10.1,
      maxMa: 220.0, minMa: 215.0, // Norian only
      referenceId: 'ref:coll-tri',
    },
    {
      id: 'col:jur', name: 'Morrison — Kimmeridgian locality',
      formation: 'Morrison Formation', member: null,
      lat: 39.7, lng: -105.2, region: 'Colorado, USA',
      palaeoLat: 31.5, palaeoLng: -60.4,
      maxMa: 153.0, minMa: 151.0, // Kimmeridgian only
      referenceId: 'ref:coll-jur',
    },
    {
      id: 'col:cre', name: 'Hell Creek — Maastrichtian locality',
      formation: 'Hell Creek Formation', member: null,
      lat: 47.1, lng: -106.8, region: 'Montana, USA',
      palaeoLat: 55.2, palaeoLng: -75.4,
      maxMa: 70.0, minMa: 67.0, // Maastrichtian only
      referenceId: 'ref:coll-cre',
    },
    {
      id: 'col:span', name: 'Judith River — Campanian–Maastrichtian locality',
      formation: 'Judith River Formation', member: null,
      lat: 47.9, lng: -108.7, region: 'Montana, USA',
      palaeoLat: 56.0, palaeoLng: -76.0,
      maxMa: 74.0, minMa: 70.0, // spans Campanian + Maastrichtian → approximate
      referenceId: 'ref:coll-cre',
    },
  ],

  occurrences: [
    { id: 'occ:tri1', collectionId: 'col:tri', taxonId: 'txn:plateosaurus', taxonAsRecorded: 'Plateosaurus trossingensis', reidentified: false, referenceId: 'ref:coll-tri' },
    { id: 'occ:jur1', collectionId: 'col:jur', taxonId: 'txn:allosaurus', taxonAsRecorded: 'Allosaurus fragilis', reidentified: false, referenceId: 'ref:coll-jur' },
    { id: 'occ:cre1', collectionId: 'col:cre', taxonId: 'txn:tyrannosaurus', taxonAsRecorded: 'Tyrannosaurus rex', reidentified: false, referenceId: 'ref:coll-cre' },
    { id: 'occ:cre2', collectionId: 'col:span', taxonId: 'txn:triceratops', taxonAsRecorded: 'Triceratops sp.', reidentified: false, referenceId: 'ref:coll-cre' },
  ],

  measurements: [],
  attributes: [],
  wikidata: [],
  wikipedia: [],
  images: [],
  editorial: [],
};
