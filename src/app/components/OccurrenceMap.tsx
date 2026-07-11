/**
 * Paleogeographic occurrence map (SPEC-003 REQ-002; SPEC-002 REQ-004). MapLibre
 * GL renders a self-contained bathymetric basemap (no tiles, no token — SEC-001)
 * and the occurrences at their reconstructed paleocoordinates as a clustered
 * GeoJSON source: clusters carry a count (group) and single points a marker
 * (individual), distinguished by shape + label, not colour alone (FONC-230/240,
 * PERF-250). Zoom/pan come from the built-in controls (FONC-250/260).
 *
 * The map is an enhancement over the always-present accessible occurrence list
 * (charter / SPEC-002 canvas-a11y edge case): where WebGL is unavailable (e.g.
 * the jsdom test environment) it degrades to a short note and the list remains
 * the equivalent path.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import type { ReadOccurrence } from '../../domain/index.js';
import styles from './exploration.module.css';

interface OccurrenceMapProps {
  occurrences: readonly ReadOccurrence[];
  selectedId: string | null;
  onSelect: (occurrenceId: string) => void;
}

const OCEAN_OUTER = '#d7e4ec';
const ACCENT = '#0f9d83';
const ACCENT_CLUSTER = '#17a98c';

/** Self-contained style — background only, no external tiles/glyphs (SEC-001). */
const BASE_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'ocean', type: 'background' as const, paint: { 'background-color': OCEAN_OUTER } }],
};

function toFeatureCollection(occurrences: readonly ReadOccurrence[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const o of occurrences) {
    const paleo = o.paleoPosition.value;
    if (!paleo) continue; // no paleocoordinate → not placeable on the paleo map
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [paleo.palaeoLng, paleo.palaeoLat] },
      properties: { id: o.id, taxon: o.taxonName },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function OccurrenceMap({
  occurrences,
  selectedId,
  onSelect,
}: OccurrenceMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [available, setAvailable] = useState(true);

  // Initialise once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let gl: RenderingContext | null = null;
    try {
      const canvas = document.createElement('canvas');
      gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    } catch {
      gl = null;
    }
    if (!gl) {
      setAvailable(false);
      return;
    }

    let cancelled = false;
    let cleanup = (): void => {};
    void (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (cancelled) return;
        const map = new maplibre.Map({
          container,
          style: BASE_STYLE as never,
          center: [-75, 55],
          zoom: 2.2,
          attributionControl: false,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;
        cleanup = (): void => {
          loadedRef.current = false;
          mapRef.current = null;
          map.remove();
        };
        map.on('load', () => {
          map.addSource('occurrences', {
            type: 'geojson',
            data: toFeatureCollection(occurrences),
            cluster: true,
            clusterRadius: 40,
          });
          // Group (cluster) — larger disc + count label.
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'occurrences',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': ACCENT_CLUSTER,
              'circle-radius': 16,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
          // Individual occurrence — smaller ring; selected gets a halo.
          map.addLayer({
            id: 'points',
            type: 'circle',
            source: 'occurrences',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': ACCENT,
              'circle-radius': ['case', ['==', ['get', 'id'], selectedId ?? ''], 9, 6],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 3, 1.5],
            },
          });
          loadedRef.current = true;

          map.on('click', 'points', (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
            const id = e.features?.[0]?.properties?.['id'];
            if (typeof id === 'string') onSelectRef.current(id);
          });
          map.on('click', 'clusters', (e: MapMouseEvent) => {
            map.easeTo({ center: e.lngLat, zoom: map.getZoom() + 2 });
          });
          for (const layer of ['points', 'clusters']) {
            map.on('mouseenter', layer, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layer, () => {
              map.getCanvas().style.cursor = '';
            });
          }
        });
      } catch {
        setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // Initialise once; data/selection are synced by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync source data when the visible occurrences change (PERF-360).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('occurrences') as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(occurrences));
  }, [occurrences]);

  // Sync the selected-point emphasis.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('points')) return;
    map.setPaintProperty('points', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      9,
      6,
    ]);
    map.setPaintProperty('points', 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      3,
      1.5,
    ]);
  }, [selectedId]);

  if (!available) {
    return (
      <div className={styles.stateWrap} role="note">
        <p>
          The interactive map needs WebGL, which isn’t available here. Use the occurrence
          list to explore — it carries the same occurrences, sources and uncertainty.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Paleogeographic map of fossil occurrences (reconstruction)"
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
