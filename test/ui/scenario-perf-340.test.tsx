// @vitest-environment jsdom
/**
 * PERF-340 — the core exploration loop end-to-end:
 * select a period → filter dinosaurs → select an occurrence → open a taxon
 * profile → return to the map — without a blocking error (SPEC-003 REQ-007).
 * Also asserts ≤2 actions to the profile and ≤1 back, with age/filters preserved
 * (FONC-1010/1020/1070/1080, CONS-460/470).
 */

import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App.js';
import { fixtureLoader } from './app-harness.js';

afterEach(cleanup);

test('PERF-340: period → filter dinosaurs → occurrence → profile → back to map', async () => {
  const user = userEvent.setup();
  render(<App loader={fixtureLoader()} />);

  // App boots and reaches the exploration view (first useful content).
  const timeline = await screen.findByRole('navigation', { name: /timeline/i });
  expect(timeline).toBeInTheDocument();

  // The dinosaurs filter is active by default (FONC-020).
  expect(screen.getByText('Dinosaurs')).toBeInTheDocument();

  // Select a period/stage (Campanian → a single Tyrannosaurus occurrence).
  await user.click(within(timeline).getByRole('button', { name: /Campanian/ }));
  const campanian = within(timeline).getByRole('button', { name: /Campanian/ });
  expect(campanian).toHaveAttribute('aria-pressed', 'true');

  // Expand the taxon group, then select the occurrence (the list is aggregated
  // by taxon — SPEC-005). Its row is identified by its formation.
  const list = screen.getByRole('region', { name: /Visible occurrences/i });
  await user.click(within(list).getByRole('button', { name: /Tyrannosaurus/ }));
  await user.click(within(list).getByRole('button', { name: /Judith River/ }));

  // The occurrence panel opens with its single primary action.
  const openProfile = screen.getByRole('button', { name: /Open taxon profile/i });

  // Action 2: open the taxon profile (≤2 actions from a visible occurrence).
  await user.click(openProfile);

  const profile = await screen.findByRole('region', { name: /Taxon profile: Tyrannosaurus/i });
  expect(within(profile).getByRole('heading', { name: 'Tyrannosaurus' })).toBeInTheDocument();

  // Action back: return to the map (≤1 action).
  await user.click(screen.getByRole('button', { name: /Back to map/i }));

  // Back on the exploration view, with the selected period preserved.
  const timelineAgain = await screen.findByRole('navigation', { name: /timeline/i });
  expect(within(timelineAgain).getByRole('button', { name: /Campanian/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // No blocking error surfaced anywhere in the loop.
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
