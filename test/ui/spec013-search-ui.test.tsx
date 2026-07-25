// @vitest-environment jsdom
/**
 * SPEC-013 REQ-001/004/005 — search box in the exploration shell. Typing a name
 * shows ranked matches; choosing one selects the taxon on the map + side panel
 * (Taxon mode) rather than opening the profile directly; a nonsense query shows
 * a designed no-match state.
 */

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorationView } from "../../src/app/components/ExplorationView.js";
import { fixtureApi } from "./app-harness.js";

afterEach(cleanup);

test("finds a taxon by name and lands it in the side panel, not the profile (REQ-001/004)", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  const box = screen.getByRole("combobox", { name: /search a dinosaur/i });
  await user.type(box, "tyr");

  const option = await screen.findByRole("option", { name: /Tyrannosaurus/i });
  await user.click(option);

  // The taxon is placed in the side panel (its "Open taxon profile" action is
  // present) while we remain on the map screen (the header search box persists) —
  // i.e. we did NOT jump straight to the profile.
  expect(
    screen.getByRole("button", { name: /Open taxon profile/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: /search a dinosaur/i }),
  ).toBeInTheDocument();
});

test("shows a designed no-match state (REQ-005)", async () => {
  const user = userEvent.setup();
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  await user.type(
    screen.getByRole("combobox", { name: /search a dinosaur/i }),
    "zzzq",
  );
  expect(await screen.findByText(/No taxon matches/i)).toBeInTheDocument();
});
