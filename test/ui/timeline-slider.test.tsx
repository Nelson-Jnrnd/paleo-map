// @vitest-environment jsdom
/**
 * SPEC-009 REQ-001/002 — the to-scale stepped timeline slider. Stage steps are
 * placed proportionally to their Ma span, the period delimitations are proportional
 * and labelled, the selected stage + span are always legible, and the control steps
 * by keyboard as a single slider (roving tabindex).
 */
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelineControl } from "../../src/app/components/TimelineControl.js";
import {
  EXPLORATION_PERIODS,
  EXPLORATION_STAGES,
} from "../../src/app/state/exploration.js";

afterEach(cleanup);

function Harness({ initial }: { initial: string }): React.ReactElement {
  const [selected, setSelected] = useState(initial);
  return (
    <TimelineControl
      stages={EXPLORATION_STAGES}
      periods={EXPLORATION_PERIODS}
      selected={selected}
      onSelect={setSelected}
      onSelectPeriod={() => {}}
    />
  );
}

function widthPct(name: string | RegExp): number {
  const el = screen.getByRole("button", { name }) as HTMLElement;
  return parseFloat(el.style.width);
}

test("period delimitations are proportional to their Ma span (Cretaceous widest)", () => {
  render(<Harness initial="Maastrichtian" />);
  const cretaceous = widthPct("Cretaceous");
  const jurassic = widthPct("Jurassic");
  const triassic = widthPct("Triassic");
  // Cretaceous (145–66) > Jurassic (201.4–145) > Triassic (251.9–201.4).
  expect(cretaceous).toBeGreaterThan(jurassic);
  expect(jurassic).toBeGreaterThan(triassic);
  // The three bands together span (almost) the whole track.
  expect(cretaceous + jurassic + triassic).toBeGreaterThan(99);
});

test("stage steps are proportional: a long stage is wider than a short one", () => {
  render(<Harness initial="Maastrichtian" />);
  // Norian (~18.5 Myr) is far wider than Induan (~0.7 Myr).
  expect(widthPct(/Norian/)).toBeGreaterThan(widthPct(/Induan/));
});

test("the selected stage name and its Ma span are always shown as text", () => {
  render(<Harness initial="Maastrichtian" />);
  expect(screen.getByText("Maastrichtian")).toBeInTheDocument();
  expect(screen.getByText("72.1–66 Ma")).toBeInTheDocument();
});

test("the timeline shows a Ma graduation (round tick labels + unit)", () => {
  render(<Harness initial="Maastrichtian" />);
  // Round Ma graduations across the Mesozoic window.
  for (const label of ["100", "150", "200", "250"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText("Ma")).toBeInTheDocument();
});

test("only the selected stage is pressed and in the tab order", () => {
  render(<Harness initial="Maastrichtian" />);
  const selected = screen.getByRole("button", { name: /Maastrichtian/ });
  const other = screen.getByRole("button", { name: /Campanian/ });
  expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(selected).toHaveAttribute("tabindex", "0");
  expect(other).toHaveAttribute("aria-pressed", "false");
  expect(other).toHaveAttribute("tabindex", "-1");
});

test("arrow keys step to the adjacent older/younger stage (one tab stop)", async () => {
  const user = userEvent.setup();
  render(<Harness initial="Kimmeridgian" />);

  const step = screen.getByRole("button", { name: /Kimmeridgian/ });
  step.focus();

  // ArrowRight → next younger stage (Tithonian) becomes selected and focused.
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("button", { name: /Tithonian/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // ArrowLeft → back to Kimmeridgian (older).
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("button", { name: /Kimmeridgian/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // End jumps to the youngest stage, Home to the oldest.
  await user.keyboard("{End}");
  expect(screen.getByRole("button", { name: /Maastrichtian/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.keyboard("{Home}");
  expect(screen.getByRole("button", { name: /Induan/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

// jsdom's PointerEvent doesn't forward clientX, so build the native event by hand
// with the coordinate defined — React reads clientX/pointerId off the nativeEvent.
function pointer(type: string, clientX: number): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clientX", { value: clientX });
  Object.defineProperty(ev, "pointerId", { value: 1 });
  Object.defineProperty(ev, "button", { value: 0 });
  return ev;
}

test("the track scrubs as a slider: press-and-drag re-selects the stage under the pointer", () => {
  render(<Harness initial="Maastrichtian" />);

  // The track is the stage steps' shared parent; give it a real width so the
  // pointer x maps back to an Ma value (jsdom reports 0 by default).
  const track = screen.getByRole("button", { name: /Maastrichtian/ })
    .parentElement as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 26,
      width: 1000,
      height: 26,
    }) as DOMRect;

  // Press near the youngest (right) end, then drag to the oldest (left) end.
  fireEvent(track, pointer("pointerdown", 990));
  fireEvent(track, pointer("pointermove", 0));
  fireEvent(track, pointer("pointerup", 0));

  // The oldest stage (leftmost) is now selected — dragging moved the age.
  expect(screen.getByRole("button", { name: /Induan/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: /Maastrichtian/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a plain press without movement does not scrub (click still selects)", () => {
  render(<Harness initial="Maastrichtian" />);
  const track = screen.getByRole("button", { name: /Maastrichtian/ })
    .parentElement as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 26,
      width: 1000,
      height: 26,
    }) as DOMRect;

  const campanian = screen.getByRole("button", { name: /Campanian/ });
  // Down + up at the same point (no movement past the threshold) leaves the drag
  // path inert, so the age is unchanged; the button's own click still selects.
  fireEvent(track, pointer("pointerdown", 200));
  fireEvent(track, pointer("pointerup", 200));
  expect(screen.getByRole("button", { name: /Maastrichtian/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  fireEvent.click(campanian);
  expect(campanian).toHaveAttribute("aria-pressed", "true");
});

test("a selected occurrence highlights its period(s) on the frieze (REQ-005)", () => {
  const { rerender } = render(
    <TimelineControl
      stages={EXPLORATION_STAGES}
      periods={EXPLORATION_PERIODS}
      selected="Maastrichtian"
      onSelect={() => {}}
      onSelectPeriod={() => {}}
      highlightRange={null}
    />,
  );
  // No selection → no period is flagged in-range.
  expect(
    screen.getByRole("button", { name: "Cretaceous" }),
  ).not.toHaveAttribute("data-inrange");

  // A Late-Cretaceous occurrence range flags the Cretaceous band, not the others.
  rerender(
    <TimelineControl
      stages={EXPLORATION_STAGES}
      periods={EXPLORATION_PERIODS}
      selected="Maastrichtian"
      onSelect={() => {}}
      onSelectPeriod={() => {}}
      highlightRange={{ minMa: 66, maxMa: 72 }}
    />,
  );
  expect(screen.getByRole("button", { name: "Cretaceous" })).toHaveAttribute(
    "data-inrange",
    "true",
  );
  expect(screen.getByRole("button", { name: "Triassic" })).not.toHaveAttribute(
    "data-inrange",
  );
});

test("period bands report the chosen period (SPEC-008 REQ-003 preserved)", async () => {
  const user = userEvent.setup();
  const onSelectPeriod = vi.fn();
  render(
    <TimelineControl
      stages={EXPLORATION_STAGES}
      periods={EXPLORATION_PERIODS}
      selected="Maastrichtian"
      onSelect={() => {}}
      onSelectPeriod={onSelectPeriod}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Triassic" }));
  expect(onSelectPeriod).toHaveBeenCalledWith("Triassic");
});
