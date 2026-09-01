// @vitest-environment jsdom
/**
 * SPEC-029 REQ-002/REQ-004/REQ-005, NFR-001/NFR-003, UX-002 — the frame toggle
 * as rendered.
 *
 * The map itself does not initialise under jsdom (no WebGL), which is exactly
 * the split these tests want: the control, its state, the age filter and the
 * disclosures all live in the shell, and the shell is what is asserted here.
 * The map's own projection is covered browser-free in
 * `test/spec029-frame-positions.test.ts`.
 */

import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

/** A basemap index, with or without the present-day frame (UX-002). */
function stubBasemap(options: { present?: boolean } = {}): {
  urls: string[];
} {
  const urls: string[] = [];
  const index = {
    model: "paleomap",
    rotationModel: "scotese",
    licence: "CC BY 4.0",
    frames: [
      {
        stage: "Maastrichtian",
        slug: "maastrichtian",
        targetAgeMa: 69.1,
        geojsonUrl: "basemap/maastrichtian.geojson",
        metaUrl: "basemap/maastrichtian.meta.json",
      },
    ],
    ...(options.present === false
      ? {}
      : {
          present: {
            targetAgeMa: 0,
            geojsonUrl: "basemap/present.geojson",
            metaUrl: "basemap/present.meta.json",
          },
        }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const body = url.endsWith("index.json")
        ? index
        : url.endsWith(".meta.json")
          ? {
              name: url.includes("present")
                ? "Present-day coastlines (0 Ma)"
                : "Maastrichtian coastlines",
              source: "GPlates Web Service",
              licence: "CC BY 4.0",
              // The occurrences' pinned model, so `describeFrame` reconciles
              // rather than reporting a mismatch.
              rotationModel: "scotese",
              model: "paleomap",
              targetAgeMa: url.includes("present") ? 0 : 69.1,
              note: "",
            }
          : { type: "FeatureCollection", features: [] };
      return {
        ok: true,
        headers: { get: () => null },
        body: null,
        json: async () => body,
      };
    }) as unknown as typeof fetch,
  );
  return { urls };
}

async function renderView(options: { present?: boolean } = {}) {
  const stub = stubBasemap(options);
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  await screen.findByRole("navigation", { name: /timeline/i });
  return { user: userEvent.setup(), ...stub };
}

/** The frame control, once the index has resolved. */
async function frameGroup() {
  // Returns bound queries, not the element — the annotation is inferred so it
  // cannot drift from what `within` actually gives back.
  return within(await screen.findByRole("radiogroup", { name: /^map$/i }));
}

test("REQ-002: the frame control offers both frames, paleogeographic by default", async () => {
  await renderView();
  const group = await frameGroup();

  const paleo = group.getByRole("radio", { name: /paleogeographic/i });
  const present = group.getByRole("radio", { name: /present day/i });
  // Deep time is the product's subject, so it is what you see first.
  expect(paleo).toHaveAttribute("aria-checked", "true");
  expect(present).toHaveAttribute("aria-checked", "false");
});

test("REQ-002: choosing present day switches the frame", async () => {
  const { user } = await renderView();
  const group = await frameGroup();

  await user.click(group.getByRole("radio", { name: /present day/i }));
  expect(group.getByRole("radio", { name: /present day/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    group.getByRole("radio", { name: /paleogeographic/i }),
  ).toHaveAttribute("aria-checked", "false");
});

test("REQ-002: the choice survives a timeline step", async () => {
  // The frame lives in the exploration state rather than inside the map, so
  // stepping the age cannot silently return to paleogeographic.
  const { user } = await renderView();
  const group = await frameGroup();
  await user.click(group.getByRole("radio", { name: /present day/i }));

  const timeline = await screen.findByRole("navigation", { name: /timeline/i });
  const steps = within(timeline).getAllByRole("button");
  await user.click(steps[Math.floor(steps.length / 2)]!);

  const after = await frameGroup();
  await waitFor(() =>
    expect(after.getByRole("radio", { name: /present day/i })).toHaveAttribute(
      "aria-checked",
      "true",
    ),
  );
});

test("REQ-004: present-day mode says the age still filters, and names the age", async () => {
  const { user } = await renderView();
  const group = await frameGroup();

  // Absent while the coastline is still changing with the age…
  expect(screen.queryByText(/still chooses which occurrences/i)).toBeNull();

  await user.click(group.getByRole("radio", { name: /present day/i }));

  // …and present once the usual cue — the coastline moving — is turned off.
  const note = await screen.findByText(/still chooses which occurrences/i);
  expect(note.textContent).toMatch(/selected age/i);
  // It names the age itself, so the statement is concrete rather than generic.
  const selectedAge = screen.getAllByText(/Maastrichtian/i);
  expect(selectedAge.length).toBeGreaterThan(0);
});

test("REQ-004: switching back removes the note", async () => {
  const { user } = await renderView();
  const group = await frameGroup();
  await user.click(group.getByRole("radio", { name: /present day/i }));
  await screen.findByText(/still chooses which occurrences/i);

  await user.click(group.getByRole("radio", { name: /paleogeographic/i }));
  await waitFor(() =>
    expect(screen.queryByText(/still chooses which occurrences/i)).toBeNull(),
  );
});

test("UX-002: with no present-day frame in the index, no control is offered", async () => {
  // A dead control is worse than none: the map behaves exactly as it did before
  // this spec, and nothing on screen promises a frame that cannot be drawn.
  await renderView({ present: false });
  await screen.findByRole("navigation", { name: /timeline/i });

  await waitFor(() =>
    expect(screen.queryByRole("radiogroup", { name: /^map$/i })).toBeNull(),
  );
  expect(screen.queryByText(/present day/i)).toBeNull();
  expect(screen.queryByText(/still chooses which occurrences/i)).toBeNull();
});

test("UX-003: the control is keyboard-operable and not colour-alone", async () => {
  const { user } = await renderView();
  const group = await frameGroup();
  const present = group.getByRole("radio", { name: /present day/i });

  present.focus();
  expect(document.activeElement).toBe(present);
  await user.keyboard("{Enter}");
  expect(present).toHaveAttribute("aria-checked", "true");

  // The state is in the accessible tree, not only in a colour: `aria-checked`
  // above, and a weight/rule class here (PERF-250).
  expect(present.className).toMatch(/frameOptionOn/);
  expect(
    group.getByRole("radio", { name: /paleogeographic/i }).className,
  ).not.toMatch(/frameOptionOn/);
});

test("NFR-001/NFR-003: switching frames fetches no stage data and no new host", async () => {
  const { user, urls } = await renderView();
  const group = await frameGroup();
  const before = urls.length;

  await user.click(group.getByRole("radio", { name: /present day/i }));
  await waitFor(() => expect(urls.length).toBeGreaterThan(before));

  const afterSwitch = urls.slice(before);
  // Only the present-day frame is newly fetched…
  expect(afterSwitch.every((u) => u.includes("basemap/present"))).toBe(true);
  // …no per-stage occurrence file is refetched: the same occurrences are simply
  // re-projected.
  expect(urls.some((u) => /stage-.*\.json/.test(u))).toBe(false);
  // …and every request is same-origin, to our own bundled artifacts.
  expect(urls.every((u) => !/^https?:\/\//.test(u))).toBe(true);
});

test("REQ-005: each frame discloses only what is true of it", async () => {
  // The two modes make different kinds of claim. Showing a reconstruction's
  // provenance over recorded coordinates would make the weaker claim look
  // stronger, which is the more dangerous direction.
  const { user } = await renderView();
  const group = await frameGroup();

  // The map region owns the attribution. Scoped, because the WebGL-unavailable
  // fallback is also a `note` under jsdom.
  const attribution = (): HTMLElement => {
    const el = document.querySelector<HTMLElement>(
      '[data-map-overlay="basemap-attribution"]',
    );
    if (!el) throw new Error("no basemap attribution rendered");
    return el;
  };

  await user.click(group.getByRole("radio", { name: /present day/i }));
  await user.click(
    within(attribution()).getByRole("button", {
      name: /basemap source and reconstruction/i,
    }),
  );
  const present = within(attribution()).getByRole("note");
  expect(present.textContent).toMatch(/Present-day coastlines/i);
  expect(present.textContent).toMatch(/recorded with each collection/i);
  expect(present.textContent).toMatch(/not reconstructions/i);
  // The paleo claim must not appear here, where it would be false.
  expect(present.textContent).not.toMatch(/reconstructed to this frame/i);
  expect(present.textContent).not.toMatch(/nearest available reconstruction/i);

  // Switching back restores the paleogeographic disclosure unchanged.
  await user.click(group.getByRole("radio", { name: /paleogeographic/i }));
  const paleo = within(attribution()).getByRole("note");
  expect(paleo.textContent).toMatch(/Maastrichtian coastlines/i);
  expect(paleo.textContent).not.toMatch(/recorded with each collection/i);
});
