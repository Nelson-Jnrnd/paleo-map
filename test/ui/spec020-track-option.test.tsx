// @vitest-environment jsdom
/**
 * SPEC-020 REQ-004, REQ-005, REQ-007, REQ-008, UX-001…UX-004 — the track option:
 * that it exists, covers practice as well as the daily, keeps each track's round
 * and record separate, states what the ranking is and is not, and disappears
 * cleanly when the popularity data is missing.
 */

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadApi } from "../../src/read/api.js";
import { DailyGenusScreen } from "../../src/app/components/DailyGenusScreen.js";
import {
  WELL_KNOWN_POOL_SIZE,
  buildGameData,
  saltForTrack,
  selectDailyGenus,
  utcDateKey,
} from "../../src/app/state/dailyGenus.js";
import { buildTaxonomyIndex } from "../../src/app/state/taxonomy.js";
import { loadRound, loadTrack } from "../../src/app/state/dailyGenusStorage.js";

/** SPEC-020 AMEND-006's information control, which is always rendered. */
function aboutToggle(): HTMLElement {
  return screen.getByRole("button", {
    name: /about the .well-known. ranking/i,
  });
}

/** Open the caveat's disclosure. */
async function openAbout(): Promise<void> {
  await userEvent.setup().click(aboutToggle());
}
import type { ReadModel, ReadProfile } from "../../src/domain/index.js";
import { clockOn, memoryStore, paddedModel } from "./spec019-harness.js";
type MemoryStore = ReturnType<typeof memoryStore>;

afterEach(cleanup);

/**
 * The padded fixture with popularity attached: the six real genera are the most
 * read, the filler ranks below them, so the well-known pool is predictable.
 */
function rankedModel(options: { popular?: boolean } = {}): ReadModel {
  const base = paddedModel();
  if (options.popular === false) return base;
  const headline = [
    "t:trex",
    "t:trike",
    "t:veloci",
    "t:diplo",
    "t:gorgo",
    "t:nyasa",
  ];
  return {
    ...base,
    profiles: base.profiles.map((p, i): ReadProfile => {
      const rank = headline.indexOf(p.taxonId);
      if (rank >= 0) return { ...p, popularity: 1_000_000 - rank };
      return { ...p, popularity: Math.max(1, 500_000 - i) };
    }),
  };
}

function renderScreen(
  model: ReadModel,
  overrides: Partial<React.ComponentProps<typeof DailyGenusScreen>> = {},
  store: MemoryStore = memoryStore(),
) {
  const api = ReadApi.fromModel(model);
  return {
    api,
    store,
    ...render(
      <DailyGenusScreen
        api={api}
        onOpenProfile={vi.fn()}
        now={clockOn("2026-08-11")}
        random={() => 0}
        store={store}
        {...overrides}
      />,
    ),
  };
}

async function guess(name: string): Promise<void> {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Guess a genus");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /guess/i }));
}

test("REQ-004: the option offers both puzzles and defaults to every genus", () => {
  renderScreen(rankedModel());
  const every = screen.getByRole("radio", { name: /every genus/i });
  const known = screen.getByRole("radio", { name: /well-known/i });
  expect(every.getAttribute("aria-checked")).toBe("true");
  expect(known.getAttribute("aria-checked")).toBe("false");
});

test("REQ-004: choosing a track persists and is reported to the shell", async () => {
  const onTrackChange = vi.fn();
  const { store } = renderScreen(rankedModel(), { onTrackChange });
  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /well-known/i }));

  expect(onTrackChange).toHaveBeenCalledWith("wellKnown");
  expect(loadTrack(store)).toBe("wellKnown");
  expect(
    screen
      .getByRole("radio", { name: /well-known/i })
      .getAttribute("aria-checked"),
  ).toBe("true");
  // SPEC-024 REQ-001: the header states the chosen track exactly once — on the
  // selected control — so the `· well-known` suffix is gone from the identity
  // line. Asserted both ways so the statement cannot silently double up again.
  expect(screen.queryByText(/Dinordle · No\. \d+ · well-known/i)).toBeNull();
  expect(screen.getByText(/Dinordle · No\. \d+/i)).toBeTruthy();
});

test("REQ-004: a stored choice is honoured on the next visit", () => {
  const store = memoryStore();
  store.setItem(
    "paleo-map:daily-genus:track",
    JSON.stringify({ track: "wellKnown" }),
  );
  renderScreen(rankedModel(), {}, store);
  expect(
    screen
      .getByRole("radio", { name: /well-known/i })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("REQ-003: the tracks are independent puzzles over their own pools", () => {
  const model = rankedModel();
  const profiles = new Map(model.profiles.map((p) => [p.taxonId, p]));
  const data = buildGameData(model.taxa, buildTaxonomyIndex(model.taxa), (id) =>
    profiles.get(id),
  );
  expect(data.wellKnownPool).toHaveLength(WELL_KNOWN_POOL_SIZE);

  // They may coincide on a given day — REQ-003 allows it and suppressing it
  // would break determinism — but each stays inside its own pool, and over a
  // stretch of days they are demonstrably different sequences.
  const start = Date.parse("2026-08-11T00:00:00Z");
  const known = new Set(data.wellKnownPool);
  for (let day = 0; day < 30; day++) {
    const key = utcDateKey(new Date(start + day * 86_400_000));
    const full = selectDailyGenus(key, data.pool, saltForTrack("full"))!;
    const wk = selectDailyGenus(
      key,
      data.wellKnownPool,
      saltForTrack("wellKnown"),
    )!;
    expect(data.pool).toContain(full);
    expect(known.has(wk)).toBe(true);
  }
  // How often the two coincide is a property of the real pools, asserted
  // against the shipped snapshot in test/spec020-well-known-pool.test.ts.
});

test("REQ-004: switching track does not destroy the round being left", async () => {
  const { store } = renderScreen(rankedModel());
  await guess("Triceratops");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();

  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /well-known/i }));
  expect(screen.getByText("0 of 8 guesses")).toBeTruthy();

  // Back again: the full track's round is restored, not restarted.
  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /every genus/i }));
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
  expect(loadRound(store, "2026-08-11", "full")?.guesses).toHaveLength(1);
});

test("REQ-005: each track stores its own round under its own key", async () => {
  const { store } = renderScreen(rankedModel());
  await guess("Triceratops");
  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /well-known/i }));
  await guess("Diplodocus");

  const full = loadRound(store, "2026-08-11", "full");
  const known = loadRound(store, "2026-08-11", "wellKnown");
  expect(full?.guesses.map((g) => g.scientificName)).toEqual(["Triceratops"]);
  expect(known?.guesses.map((g) => g.scientificName)).toEqual(["Diplodocus"]);
  // Two keys, two rounds: neither overwrote the other.
  expect(store.map.has("paleo-map:daily-genus:round")).toBe(true);
  expect(store.map.has("paleo-map:daily-genus:round:wellKnown")).toBe(true);
});

test("REQ-004: practice honours the chosen track", async () => {
  renderScreen(rankedModel(), { mode: "practice", track: "wellKnown" });
  expect(screen.getByText(/Practice — not today’s puzzle/i)).toBeTruthy();
  expect(screen.getByLabelText("Guess a genus")).toBeTruthy();
  expect(
    screen
      .getByRole("radio", { name: /well-known/i })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("UX-001: the disclosed caveat says what the ranking is, and what it is not", async () => {
  // AMEND-006 moved the caveat behind the information control; UX-001 requires
  // its *wording*, and the wording is unchanged.
  renderScreen(rankedModel());
  await openAbout();
  const about = screen.getByText(/ranks genera by how often people read/i);
  expect(about.textContent).toMatch(/attention, not of scientific importance/i);
});

test("UX-002: the anglophone bias is stated, not hidden", async () => {
  renderScreen(rankedModel());
  await openAbout();
  expect(screen.getByText(/English Wikipedia/i)).toBeTruthy();
});

test("UX-001: no per-taxon view count is displayed anywhere", async () => {
  const { container } = renderScreen(rankedModel());
  await guess("Triceratops");
  const text = container.textContent ?? "";
  expect(text).not.toContain("1,000,000");
  expect(text).not.toMatch(/\d[\d,]*\s*views/i);
  expect(text).not.toMatch(/pageviews/i);
});

test("REQ-008/UX-003: with no popularity the option is absent and the full track plays", async () => {
  renderScreen(rankedModel({ popular: false }));
  expect(screen.queryByRole("radio", { name: /well-known/i })).toBeNull();
  expect(screen.queryByRole("radio", { name: /every genus/i })).toBeNull();
  // And the game itself is unaffected.
  expect(screen.getByLabelText("Guess a genus")).toBeTruthy();
  await guess("Triceratops");
  expect(screen.getByText("1 of 8 guesses")).toBeTruthy();
});

test("UX-004: the option is a labelled radio group, operable by keyboard", async () => {
  renderScreen(rankedModel());
  const group = screen.getByRole("radiogroup", { name: /which puzzle/i });
  expect(group).toBeTruthy();
  const known = screen.getByRole("radio", { name: /well-known/i });
  known.focus();
  await userEvent.setup().keyboard("{ }");
  expect(known.getAttribute("aria-checked")).toBe("true");
});

/* SPEC-024 REQ-001…REQ-003 — the track choice as two header controls ---------- */

test("SPEC-020 AMEND-006: the caveat sits behind a control that is always on the surface", async () => {
  const { container } = renderScreen(rankedModel());
  const caveat = /a measure of attention, not of scientific importance/i;

  // Closed on load — the *control*, not the caveat, is what is always visible.
  expect(screen.queryByText(caveat)).toBeNull();
  const toggle = aboutToggle();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");

  // One deliberate action reveals it, as a real element in the document.
  await userEvent.setup().click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  const revealed = screen.getByText(caveat);
  expect(revealed).toBeTruthy();
  expect(toggle.getAttribute("aria-controls")).toBe(revealed.id);

  // Still a rendered element and never a tooltip: a `title` is unreachable by
  // touch and by keyboard, which AMEND-006 preserves as a constraint.
  for (const el of container.querySelectorAll("[title]")) {
    expect(el.getAttribute("title")).not.toMatch(caveat);
  }

  // And the control is there on the other track too, so the caveat is reachable
  // in every state the option is rendered in.
  await userEvent
    .setup()
    .click(screen.getByRole("radio", { name: /well-known/i }));
  expect(aboutToggle()).toBeTruthy();
});

test("SPEC-020 AMEND-006: the disclosure is keyboard-operable", async () => {
  renderScreen(rankedModel());
  const toggle = aboutToggle();
  toggle.focus();
  expect(document.activeElement).toBe(toggle);
  await userEvent.setup().keyboard("{Enter}");
  expect(
    screen.getByText(/a measure of attention, not of scientific importance/i),
  ).toBeTruthy();
  // Toggling closed again is the same control, not a second one.
  await userEvent.setup().keyboard("{Enter}");
  expect(
    screen.queryByText(/a measure of attention, not of scientific importance/i),
  ).toBeNull();
});

test("SPEC-024 REQ-003: the pool size is described, and previews on focus as well as hover", async () => {
  renderScreen(rankedModel());
  const every = screen.getByRole("radio", { name: /every genus/i });
  const known = screen.getByRole("radio", { name: /well-known/i });

  // The detail is a real element the control points at — not a bare title.
  const describedBy = every.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const detail = document.getElementById(describedBy!);
  expect(detail).not.toBeNull();
  expect(every.getAttribute("title")).toBeNull();
  expect(known.getAttribute("title")).toBeNull();

  // The selected track's size is shown with no interaction.
  expect(detail!.textContent).toMatch(/genera in the snapshot/i);

  // Keyboard focus previews the other track's size — hover is not the only path.
  fireEvent.focus(known);
  expect(detail!.textContent).toMatch(/most read about/i);
  fireEvent.blur(known);
  expect(detail!.textContent).toMatch(/genera in the snapshot/i);

  // Pointer hover previews it too, in the same slot.
  fireEvent.mouseEnter(known);
  expect(detail!.textContent).toMatch(/most read about/i);
  fireEvent.mouseLeave(known);
  expect(detail!.textContent).toMatch(/genera in the snapshot/i);

  // The slot is not a live region: it must not be announced on every hover.
  expect(detail!.getAttribute("aria-live")).toBeNull();
});
