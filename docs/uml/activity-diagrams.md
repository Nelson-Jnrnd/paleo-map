# Activity Diagrams

> Diagram page. Status: **planned**. Source files (planned) under
> `../assets/uml/`. Convention: PlantUML (see [README](README.md)).

Activity diagrams capture user-facing flows through the atlas. Each section below
is one diagram. Keep them product-facing — model what the user does and sees, not
backend steps.

---

## Main exploration flow

**Source (planned):** `../assets/uml/exploration-flow.puml`

**Purpose:** the top-level loop — load the exploration view, orient via age/group/
count, and branch into time change, filtering, occurrence selection, or search.

**Related requirements:** FONC-010, FONC-020, FONC-030, FONC-040, FONC-050,
FONC-060, CONS-450, PERF-340.

**Outline:** open app → show loading state (FONC-1260) → render map + time control
+ filters with dinosaurs active by default → display age, group, count → user
chooses a branch (change age / filter / select occurrence / search / reset).

**TODO:** [ ] author `.puml`; [ ] link to sub-flows; [ ] add requirement notes.

---

## Age change flow

**Source (planned):** `../assets/uml/age-change-flow.puml`

**Purpose:** what happens when the selected age changes.

**Related requirements:** FONC-120, FONC-130, FONC-140, FONC-150, FONC-160,
FONC-170, PERF-030, PERF-360.

**Outline:** user moves the time control (stepping by geological stage, per
OQ-030) → update selected age (Ma) → redraw map for age → recompute visible
occurrences by time-range overlap → update count → if update >500 ms show
indicator (PERF-050). No full reload (PERF-360).

**TODO:** [ ] author `.puml`; [x] age granularity resolved (OQ-030): stepped by
geological stage.

---

## Filter application flow

**Source (planned):** `../assets/uml/filter-application-flow.puml`

**Purpose:** applying, combining, and clearing filters.

**Related requirements:** FONC-780, FONC-790, FONC-800, FONC-850, FONC-860,
FONC-870, FONC-880, FONC-080, PERF-370.

**Outline:** user opens filters → choose period / group / dinosaurs-only →
recompute results → update count → if zero results show empty state (branch to
empty-state flow) → user removes one filter or resets all → recompute.

**TODO:** [ ] author `.puml`; [ ] show single-remove vs reset-all branches.

---

## Occurrence selection flow

**Source (planned):** `../assets/uml/occurrence-selection-flow.puml`

**Purpose:** selecting an occurrence and opening its info panel.

**Related requirements:** FONC-270, FONC-280, FONC-290, FONC-890…FONC-930,
FONC-1100, FONC-1130, FONC-1140, FONC-1150.

**Outline:** user selects a point/cluster → if cluster, zoom/expand → select
individual occurrence → open info panel with taxon, time range, modern + paleo
position, source, and uncertainty labels → offer "open taxon profile".

**TODO:** [ ] author `.puml`; [ ] model cluster-expansion branch (PERF-100).

---

## Taxon profile opening flow

**Source (planned):** `../assets/uml/taxon-profile-flow.puml`

**Purpose:** opening a profile from an occurrence or search result, then returning
to the map with preserved state.

**Related requirements:** FONC-990, FONC-1000, FONC-1010, FONC-1020, FONC-1070,
FONC-1080, CONS-460, CONS-470, PERF-040, PERF-350.

**Outline:** from occurrence panel or search result → open profile (show loading
if needed, FONC-1270) → render profile content (≤2 actions from occurrence) → user
returns to map (≤1 action) → selected age and filters preserved.

**TODO:** [ ] author `.puml`; annotate the ≤2 / ≤1 action limits, counting an
_action_ per OQ-040 (a click/tap or keyboard equivalent that causes a transition;
hover/scroll/zoom/pan excluded).

---

## Empty state flow

**Source (planned):** `../assets/uml/empty-state-flow.puml`

**Purpose:** reaching and leaving empty states (no filtered occurrences / no
search results).

**Related requirements:** FONC-860, FONC-1280, FONC-1290, PERF-320, PERF-330,
FONC-080.

**Outline:** filters or search yield zero results → show explicit empty state →
offer recovery (reset filters / adjust search) → return to populated view.

**TODO:** [ ] author `.puml`; [ ] cover both the filter and search entry points.
