// @vitest-environment jsdom
/**
 * SPEC-006 UX-002 — the loading surface renders a determinate progressbar with a
 * text percentage when a ratio is known, and a labelled indeterminate bar (no
 * aria-valuenow, byte detail) otherwise.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoadingState } from "../../src/app/components/states.js";

afterEach(cleanup);

test("determinate: progressbar carries aria-valuenow and a percentage", () => {
  render(
    <LoadingState
      progress={{
        phase: "downloading",
        ratio: 0.42,
        receivedBytes: 1_900_000,
        totalBytes: 4_500_000,
      }}
    />,
  );
  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", "42");
  expect(screen.getByText("42%")).toBeInTheDocument();
  expect(screen.getByText(/Downloading fossil data/i)).toBeInTheDocument();
});

test("indeterminate: progressbar has no aria-valuenow and shows MB downloaded", () => {
  render(
    <LoadingState
      progress={{ phase: "downloading", receivedBytes: 1_500_000 }}
    />,
  );
  const bar = screen.getByRole("progressbar");
  expect(bar).not.toHaveAttribute("aria-valuenow");
  expect(screen.getByText(/1\.5 MB/)).toBeInTheDocument();
});

test("preparing phase relabels the surface", () => {
  render(<LoadingState progress={{ phase: "preparing", ratio: 1 }} />);
  expect(screen.getByText(/Preparing the view/i)).toBeInTheDocument();
});

test("no progress yet: shows the default downloading label", () => {
  render(<LoadingState progress={null} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    /Downloading fossil data/i,
  );
});
