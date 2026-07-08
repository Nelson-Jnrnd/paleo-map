# Sequence Diagrams

> Diagram page. Status: **planned**. Source files (planned) under
> `../assets/uml/`. Convention: PlantUML (see [README](README.md)).

Sequence diagrams describe interactions over time. Keep them **product-facing**:
model the Explorer interacting with the interface and its views. The repository
has no backend, database, or API defined, so **do not introduce a server, data
store, or service tier** in these diagrams unless and until such architecture is
specified. Where an external data source is implied, represent it abstractly
(e.g. a "Data" participant). Per [OQ-060](../product/open-questions.md#oq-060--source-datasets-that-supply-occurrences-and-time-ranges)
(resolved), the concrete source — the Paleobiology Database (PBDB) for
occurrences/time ranges and a plate-rotation model for paleogeographic positions —
is a **technical-design decision for a future design spec**, so these diagrams
keep the data source abstract and source-neutral.

Each section below is one planned diagram.

---

## Occurrence → taxon profile

**Source (planned):** `../assets/uml/occurrence-to-profile-sequence.puml`

**Purpose:** the interaction from selecting an occurrence on the map to viewing
its taxon profile and returning to the map with state preserved.

**Related requirements:** FONC-270, FONC-280, FONC-290, FONC-990, FONC-1010,
FONC-1020, FONC-1070, FONC-1080.

**Participants (product-facing):** Explorer, Exploration View, Occurrence Panel,
Taxon Profile.

**TODO:** [ ] author `.puml`; annotate the ≤2 / ≤1 action limits, counting an
_action_ per OQ-040 (a click/tap or keyboard equivalent that causes a transition).

---

## Search → profile → occurrences on map

**Source (planned):** `../assets/uml/search-to-map-sequence.puml`

**Purpose:** the MVP validation scenario PERF-350 — search a taxon, open its
profile, then show its occurrences on the map.

**Related requirements:** FONC-760, FONC-510, FONC-560, PERF-350.

**Participants:** Explorer, Search, Taxon Profile, Exploration View.

**TODO:** [ ] author `.puml`; [ ] show the map re-centering on the taxon's
occurrences.

---

## Age change → map & occurrence update

**Source (planned):** `../assets/uml/age-change-sequence.puml`

**Purpose:** the interaction of moving the time control and observing the map and
occurrences update (PERF-360).

**Related requirements:** FONC-120, FONC-130, FONC-140, FONC-150, PERF-030,
PERF-360.

**Participants:** Explorer, Time Control, Exploration View (Map), Data (abstract).

**TODO:** [ ] author `.puml`; keep the Data participant abstract and
source-neutral — the concrete source (PBDB + plate-rotation model) is deferred to
a design spec (OQ-060, resolved).

---

## Notes

- Only add sequence diagrams that clarify a genuine multi-step interaction; simple
  single-step actions are better captured by the activity diagrams.
- If a future spec introduces a backend/API, revisit these diagrams to add the
  appropriate participants and update the traceability matrix.
