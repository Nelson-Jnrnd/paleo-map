/**
 * DATA-004 (live increment) — the HTTP source client is a drop-in for the
 * `SourceClient` interface over the real upstreams (PBDB REST + Wikidata SPARQL
 * + MediaWiki/Commons). This exercises the adapter with a stubbed `fetch` (no
 * egress): it must map the compact PBDB/Wikidata/MediaWiki shapes into a
 * `SourceSubset` that ingest → derive → validate accepts, wiring the typed
 * source chain (PBDB reference, Wikidata QID join, Commons licence).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpSourceClient } from '../src/pipeline/http-client.js';
import { buildReadModel } from '../src/pipeline/build.js';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

/** Route a stubbed fetch by URL to a canned upstream payload. */
function routeFetch(url: string): Response {
  if (url.includes('/taxa/list.json')) {
    return jsonResponse({
      records: [
        {
          oid: 'txn:38613', nam: 'Tyrannosaurus', rnk: 'genus', par: 'txn:92294',
          att: 'Osborn 1905', rid: 'ref:9259',
          jdt: 'carnivore', jmo: 'actively mobile', jev: 'terrestrial',
        },
        {
          oid: 'txn:56321', nam: 'Manospondylus', rnk: 'genus', par: 'txn:92294',
          att: 'Cope 1892', rid: 'ref:cope', tdf: 'subjective synonym of',
        },
      ],
    });
  }
  if (url.includes('/occs/list.json')) {
    return jsonResponse({
      records: [
        {
          oid: 'occ:1', cid: 'col:1', tid: 'txn:54833', gnl: 'Tyrannosaurus',
          tna: 'Tyrannosaurus rex', rid: 'ref:eberth', eid: 'rei:1',
          eag: 68.0, lag: 66.0, lng: -106.8, lat: 47.1,
          pln: -77.0, pla: 55.2, pm1: 'scotese',
          cnm: 'Hell Creek locality', sfm: 'Hell Creek', cc2: 'US', stp: 'Montana',
        },
      ],
    });
  }
  if (url.includes('/refs/list.json')) {
    return jsonResponse({
      records: [
        { oid: 'ref:9259', ref: 'Osborn, H.F. 1905. Tyrannosaurus.', pby: '1905' },
        { oid: 'ref:cope', ref: 'Cope, E.D. 1892. Manospondylus.', pby: '1892' },
        { oid: 'ref:eberth', ref: 'Eberth, D.A. 2001. Hell Creek.', pby: '2001' },
      ],
    });
  }
  if (url.includes('query.wikidata.org')) {
    return jsonResponse({
      results: {
        bindings: [
          {
            name: { value: 'Tyrannosaurus' },
            item: { value: 'http://www.wikidata.org/entity/Q14332' },
            article: { value: 'https://en.wikipedia.org/wiki/Tyrannosaurus' },
          },
        ],
      },
    });
  }
  if (url.includes('en.wikipedia.org/w/api.php')) {
    return jsonResponse({
      query: {
        pages: [
          {
            title: 'Tyrannosaurus',
            extract: 'Tyrannosaurus is a genus of large theropod dinosaur.',
            pageimage: 'Trex.jpg',
          },
        ],
      },
    });
  }
  if (url.includes('commons.wikimedia.org')) {
    return jsonResponse({
      query: {
        pages: [
          {
            title: 'File:Trex.jpg',
            imageinfo: [
              {
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Trex.jpg',
                extmetadata: {
                  LicenseShortName: { value: 'CC BY-SA 3.0' },
                  Artist: { value: '<a href="#">Jane Doe</a>' },
                },
              },
            ],
          },
        ],
      },
    });
  }
  throw new Error(`unexpected fetch: ${url}`);
}

describe('DATA-004 (live): HttpSourceClient maps upstreams into a valid model', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn((url: string) => Promise.resolve(routeFetch(url)));
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches a source subset with the typed source chain', async () => {
    const client = new HttpSourceClient({ log: () => {} });
    const subset = await client.fetchSubset();

    expect(subset.metadata.rotationModel).toBe('scotese');
    expect(subset.taxa.map((t) => t.name).sort()).toEqual(['Manospondylus', 'Tyrannosaurus']);
    // Synonym status is mapped from PBDB's `tdf`.
    expect(subset.opinions.find((o) => o.taxonId === 'txn:56321')?.status).toBe('Synonymous');
    // Ecospace → typed biology attributes.
    expect(subset.attributes.find((a) => a.kind === 'Diet')?.value).toBe('Carnivore');
    // Wikidata QID join by taxon name.
    expect(subset.wikidata).toHaveLength(1);
    expect(subset.wikidata[0]).toMatchObject({ qid: 'Q14332', pbdbTaxonId: 'txn:38613' });
    // Commons licence + credit captured (DATA-007 input).
    expect(subset.images[0]).toMatchObject({ licence: 'CC BY-SA 3.0', credit: 'Jane Doe' });
  });

  it('builds a valid, wired read model from the live subset', async () => {
    const model = await buildReadModel(new HttpSourceClient({ log: () => {} }));

    // Occurrence resolves to the captured genus, with a paleocoordinate from the
    // pinned rotation model.
    const occ = model.occurrences.find((o) => o.id === 'occ:1')!;
    expect(occ.taxonId).toBe('txn:38613');
    expect(occ.paleoPosition.value?.rotationModel).toBe('scotese');
    expect(occ.paleoPosition.value).not.toBeNull();

    // Profile carries the encyclopedic summary + a showable, licensed image.
    const profile = model.profiles.find((p) => p.taxonId === 'txn:38613')!;
    expect(profile.summary?.value).toContain('theropod');
    expect(profile.images).toHaveLength(1);
    expect(profile.images[0]).toMatchObject({ licence: 'CC BY-SA 3.0', credit: 'Jane Doe' });

    // Validity resolves to the PBDB primary reference.
    const trex = model.taxa.find((t) => t.id === 'txn:38613')!;
    expect(trex.validity.value).toBe('Valid');
    expect(trex.acceptedPer).toContain('Osborn');
  });
});
