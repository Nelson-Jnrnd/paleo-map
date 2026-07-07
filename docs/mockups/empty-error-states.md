# Screens: Empty & Error States

> Mockup page. Status: **planned**. Images (planned):
> `../assets/mockups/empty-state.png`, `../assets/mockups/error-state.png`.
> Convention: see [README](README.md).

A shared catalog of the empty and error states required across screens. Each state
records its **trigger**, what the **user sees**, and the **recovery** action. The
common rule: never show a blank; always explain and offer a way forward, and
preserve filters through failures.

## Related requirements

FONC-860, FONC-1280, FONC-1290, FONC-1300, FONC-1310, FONC-1320, FONC-1330,
FONC-1340, PERF-280, PERF-290, PERF-300, PERF-310, PERF-320, PERF-330.

## Empty states

### No occurrences after filters

- **Trigger:** active filters match no occurrence (FONC-1280, FONC-860, PERF-320).
- **User sees:** an explicit empty state on the map/results area, with the active
  filters still shown.
- **Recovery:** remove a filter or reset all filters (FONC-870, FONC-880).
- **Mockup:** `empty-state.png`.

### No search result

- **Trigger:** a search matches no taxon (FONC-1290, PERF-330).
- **User sees:** an explicit empty state for the search.
- **Recovery:** adjust or clear the search term.
- **Mockup:** `search-empty.png`.

### Minimal-data profile

- **Trigger:** a taxon profile exists but has only minimal data (FONC-1300,
  FONC-480).
- **User sees:** the profile with an explicit "minimal/incomplete" message and
  labeled missing fields (FONC-490).
- **Recovery:** none required; informational. Return to map remains available.
- **Mockup:** `taxon-profile-minimal.png`.

## Error states

### Map load failure

- **Trigger:** map data cannot be loaded (FONC-1310, PERF-280).
- **User sees:** a clear error message in place of the map.
- **Recovery:** retry without reloading the whole app (FONC-1330, PERF-300);
  active filters preserved (FONC-1340, PERF-310).
- **Mockup:** `error-state.png`.

### Taxon profile load failure

- **Trigger:** a taxon profile cannot be loaded (FONC-1320, PERF-290).
- **User sees:** a clear error message in place of the profile content.
- **Recovery:** retry (FONC-1330, PERF-300); active filters preserved (FONC-1340,
  PERF-310).
- **Mockup:** `taxon-profile-error.png`.

## Retry behavior (shared)

- Retry re-attempts only the failed load; it does not reload the entire
  application (FONC-1330, PERF-300).
- On retry the view returns to its loading state, then success or the same error.

## Preserved filters after failure (shared)

- After any profile, map, or occurrence load failure, the active filter set is
  retained so the user does not lose context (FONC-1340, PERF-310).

## Notes

- Error and empty messaging must be clear and non-sensationalist (CONS-320,
  CONS-330) and must not rely on color alone (PERF-250).

## TODO

- [ ] Add `empty-state.png` and `error-state.png` (plus per-screen variants).
- [ ] Confirm retry affordance placement per screen.
- [ ] Annotate each state with its requirement ID(s).
