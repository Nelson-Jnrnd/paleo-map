// @vitest-environment jsdom
/**
 * SPEC-010 REQ-001 — the grouping-mode control: three options (Occurrences /
 * Localities / Taxa), default Occurrences, switching re-renders the list under the
 * new unit while the stage is preserved; the rank selector shows only in Taxon mode.
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

async function renderApp() {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);
  return within(
    await screen.findByRole("group", { name: /group occurrences by/i }),
  );
}

test("defaults to Occurrences and offers the three modes", async () => {
  const group = await renderApp();
  expect(group.getByRole("button", { name: "Occurrences" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(group.getByRole("button", { name: "Localities" })).toBeInTheDocument();
  expect(group.getByRole("button", { name: "Taxa" })).toBeInTheDocument();
  // No rank selector outside Taxon mode.
  expect(screen.queryByRole("combobox", { name: /group by rank/i })).toBeNull();
  expect(
    screen.getByRole("region", { name: /occurrences on the map/i }),
  ).toBeInTheDocument();
  // REQ-002: the cluster legend discloses that a cluster counts records, not taxa.
  expect(
    screen.getByText(/clusters count fossil records .* not distinct taxa/i),
  ).toBeInTheDocument();
});

test("switching to Localities re-renders the list under the new unit", async () => {
  const user = userEvent.setup();
  const group = await renderApp();
  await user.click(group.getByRole("button", { name: "Localities" }));
  expect(group.getByRole("button", { name: "Localities" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(group.getByRole("button", { name: "Occurrences" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    screen.getByRole("region", { name: /localities on the map/i }),
  ).toBeInTheDocument();
});

test("Taxon mode reveals the rank selector; other modes hide it", async () => {
  const user = userEvent.setup();
  const group = await renderApp();
  await user.click(group.getByRole("button", { name: "Taxa" }));
  expect(
    screen.getByRole("combobox", { name: /group by rank/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: /taxa on the map/i }),
  ).toBeInTheDocument();

  await user.click(group.getByRole("button", { name: "Occurrences" }));
  expect(screen.queryByRole("combobox", { name: /group by rank/i })).toBeNull();
});
