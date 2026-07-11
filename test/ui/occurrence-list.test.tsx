// @vitest-environment jsdom
/**
 * SPEC-003 REQ-003 — the keyboard-reachable occurrence list: every visible
 * occurrence is a focusable control showing taxon, time range in Ma and an
 * identifiable source, with reconstructed / approximate / missing marked by text
 * labels, not colour alone (FONC-1100/1130/1140/1150, PERF-140/150/250).
 */

import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ExplorationView } from '../../src/app/components/ExplorationView.js';
import { fixtureApi } from './app-harness.js';

afterEach(cleanup);

test('lists visible occurrences with source and uncertainty cues', async () => {
  const api = await fixtureApi();
  render(<ExplorationView api={api} />);

  const list = screen.getByRole('region', { name: /Visible occurrences/i });
  const rows = within(list).getAllByRole('button');
  const expected = api.listOccurrences({ stage: 'Maastrichtian' });
  expect(rows).toHaveLength(expected.length);

  // Every visible occurrence carries an identifiable source (PERF-140) and a
  // time range in Ma (PERF-150).
  expect(within(list).getAllByText(/^Source:/)).toHaveLength(expected.length);
  expect(within(list).getAllByText(/Ma$/).length).toBeGreaterThanOrEqual(expected.length);

  // Reconstructed positions and the approximate range are labeled with text.
  expect(within(list).getAllByText('Reconstructed').length).toBeGreaterThan(0);
  expect(within(list).getByText('Approximate')).toBeInTheDocument();

  // The occurrence with no paleocoordinate is shown with an explicit label.
  expect(within(list).getAllByText('Not available').length).toBeGreaterThan(0);

  // Rows are real, focusable controls (keyboard reachable — PERF-230).
  const first = rows[0]!;
  first.focus();
  expect(first).toHaveFocus();
});
