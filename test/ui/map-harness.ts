/**
 * A fake MapLibre for jsdom (SPEC-027 test plan).
 *
 * SPEC-027's map requirements are about *what the map is told to draw* — which
 * features land in the emphasis overlay, which layers dim, whether the base
 * source is re-fed on a selection, whether the camera is asked to move. Those
 * are assertions about the calls `OccurrenceMap` makes, so they need a map
 * object rather than a GPU. This records every call and lets tests drive the
 * handlers the real map would fire.
 *
 * It is deliberately thin: it implements only the surface `OccurrenceMap` uses,
 * and it does not simulate clustering, projection or hit-testing. Anything that
 * depends on real rendering (icon atlases, label collision on screen, actual
 * cluster geometry) stays a manual or e2e check, as the spec records.
 */

export interface FakeSource {
  id: string;
  options: Record<string, unknown>;
  /** Every payload handed to `setData`, newest last. */
  setDataCalls: unknown[];
  data: unknown;
  setData: (data: unknown) => void;
  getClusterLeaves?: (
    clusterId: number,
    limit: number,
    offset: number,
  ) => Promise<unknown[]>;
}

export interface FakeLayer {
  id: string;
  spec: Record<string, unknown>;
  paint: Record<string, unknown>;
  layout: Record<string, unknown>;
}

type Handler = (arg?: unknown) => void;

export class FakeMap {
  static instances: FakeMap[] = [];

  sources = new Map<string, FakeSource>();
  layers = new Map<string, FakeLayer>();
  handlers = new Map<string, Handler[]>();
  fitBoundsCalls: Array<{ bounds: unknown; options: unknown }> = [];
  easeToCalls: unknown[] = [];
  removed = false;

  /** Features `queryRenderedFeatures` should return, keyed by layer id. */
  rendered = new Map<string, unknown[]>();
  private zoom = 2.2;
  private bounds = { west: -180, south: -85, east: 180, north: 85 };

  constructor(public options: Record<string, unknown>) {
    FakeMap.instances.push(this);
  }

  // --- lifecycle -----------------------------------------------------------
  on(event: string, handler: Handler): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }
  /** Fire the handlers registered for an event, as the real map would. */
  fire(event: string, arg?: unknown): void {
    for (const h of [...(this.handlers.get(event) ?? [])]) h(arg);
  }
  addControl(): void {}
  remove(): void {
    this.removed = true;
  }

  // --- images --------------------------------------------------------------
  private images = new Set<string>();
  hasImage(id: string): boolean {
    return this.images.has(id);
  }
  addImage(id: string): void {
    this.images.add(id);
  }

  // --- sources & layers ----------------------------------------------------
  addSource(id: string, options: Record<string, unknown>): void {
    const source: FakeSource = {
      id,
      options,
      data: options["data"],
      setDataCalls: [],
      setData(data: unknown) {
        this.data = data;
        this.setDataCalls.push(data);
      },
    };
    if (options["cluster"]) {
      source.getClusterLeaves = () => Promise.resolve([]);
    }
    this.sources.set(id, source);
  }
  getSource(id: string): FakeSource | undefined {
    return this.sources.get(id);
  }
  addLayer(spec: Record<string, unknown>): void {
    this.layers.set(spec["id"] as string, {
      id: spec["id"] as string,
      spec,
      paint: { ...((spec["paint"] as Record<string, unknown>) ?? {}) },
      layout: { ...((spec["layout"] as Record<string, unknown>) ?? {}) },
    });
  }
  getLayer(id: string): FakeLayer | undefined {
    return this.layers.get(id);
  }
  setPaintProperty(layerId: string, prop: string, value: unknown): void {
    const layer = this.layers.get(layerId);
    if (layer) layer.paint[prop] = value;
  }
  setLayoutProperty(layerId: string, prop: string, value: unknown): void {
    const layer = this.layers.get(layerId);
    if (layer) layer.layout[prop] = value;
  }

  // --- camera & query ------------------------------------------------------
  getZoom(): number {
    return this.zoom;
  }
  setZoom(z: number): void {
    this.zoom = z;
  }
  setBounds(b: {
    west: number;
    south: number;
    east: number;
    north: number;
  }): void {
    this.bounds = b;
  }
  getBounds() {
    const b = this.bounds;
    return {
      getWest: () => b.west,
      getSouth: () => b.south,
      getEast: () => b.east,
      getNorth: () => b.north,
    };
  }
  project(lngLat: [number, number]) {
    // A crude equirectangular projection is enough: overlays only need stable,
    // distinct pixel positions, never cartographic accuracy.
    return { x: (lngLat[0] + 180) * 2, y: (90 - lngLat[1]) * 2 };
  }
  fitBounds(bounds: unknown, options: unknown): void {
    this.fitBoundsCalls.push({ bounds, options });
  }
  easeTo(options: unknown): void {
    this.easeToCalls.push(options);
  }
  queryRenderedFeatures(
    pointOrOptions?: unknown,
    maybeOptions?: { layers?: string[] },
  ): unknown[] {
    const options =
      maybeOptions ??
      (pointOrOptions as { layers?: string[] } | undefined) ??
      {};
    const layers = options.layers ?? [...this.rendered.keys()];
    return layers.flatMap((l) => this.rendered.get(l) ?? []);
  }
  getCanvas() {
    return { style: {} as Record<string, string> };
  }
}

class FakeNavigationControl {}

/** The module object to hand back from `vi.mock("maplibre-gl", ...)`. */
export function fakeMapLibreModule(): Record<string, unknown> {
  return { Map: FakeMap, NavigationControl: FakeNavigationControl };
}

/**
 * Make the component's WebGL probe succeed and its bundled-icon decode resolve.
 *
 * Without this, two things stall the map's `load` handler in jsdom: the WebGL
 * guard bails to the no-canvas fallback, and `new Image()` never fires `onload`,
 * so the icon `Promise.all` never settles and no layer is ever added.
 */
export function enableFakeCanvas(): void {
  HTMLCanvasElement.prototype.getContext = ((kind: string) => {
    if (kind === "2d") {
      return {
        imageSmoothingQuality: "high",
        drawImage: () => {},
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(Math.max(1, w * h) * 4),
        }),
      };
    }
    return {}; // a truthy "webgl" context
  }) as typeof HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    set(this: HTMLImageElement) {
      queueMicrotask(() => this.onload?.(new Event("load")));
    },
    get() {
      return "";
    },
  });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    configurable: true,
    get: () => 64,
  });
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
    configurable: true,
    get: () => 64,
  });
}

/** Undo `enableFakeCanvas`, restoring the quiet no-WebGL default. */
export function disableFakeCanvas(): void {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
  delete (HTMLImageElement.prototype as unknown as Record<string, unknown>)[
    "src"
  ];
  FakeMap.instances = [];
}

/** How many fake maps exist — the component constructs one lazily, after render. */
export function mapCount(): number {
  return FakeMap.instances.length;
}

/** The most recently constructed fake map (the one the component is driving). */
export function currentMap(): FakeMap {
  const map = FakeMap.instances.at(-1);
  if (!map) throw new Error("no FakeMap was constructed");
  return map;
}
