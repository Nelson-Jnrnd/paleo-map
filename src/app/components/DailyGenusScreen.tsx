/**
 * Dinordle — the screen (SPEC-019; named "Daily Genus" until SPEC-022). One
 * hidden genus a day; every guess is a
 * genus, and what comes back is the deepest clade it shares with the answer plus
 * the branch that share rules out.
 *
 * **The tree is the screen, not a component on it** (mockup
 * `docs/mockups/daily-genus.md`, charter + anti-slop checklist). The established
 * trunk descends from `Dinosauria`, each ruled-out branch hangs off the node
 * where the guess and the answer parted, and the guess that eliminated it labels
 * the terminal — the clade verdict needs no list, because the guesses *are* the
 * branches. Time is a stratigraphic column rather than a badge per guess.
 *
 * The two SPEC-028 channels — shared countries and occurrence count — are the
 * exception, and a deliberate one (SPEC-028 AMEND-001): the tree positions a
 * guess by clade, so it cannot place a geographic or abundance fact meaningfully,
 * and marks crammed onto its rows overflowed the diagram. They live in their own
 * table beneath the board.
 *
 * All game logic lives in `../state/dailyGenus.js`; this file is presentation,
 * the injected clock, and the storage adapter. No network (NFR-001).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { ReadApi } from "../../read/api.js";
import { MESOZOIC_PERIODS, MESOZOIC_STAGES } from "../../domain/index.js";
import { buildTaxonomyIndex } from "../state/taxonomy.js";
import {
  MAX_GUESSES,
  MIN_POOL_SIZE,
  applyGuess,
  buildGameData,
  evaluateGuess,
  formatCountdown,
  msUntilNextUtcDay,
  poolForTrack,
  puzzleNumber,
  resolveGuess,
  revealedTree,
  saltForTrack,
  selectDailyGenus,
  selectPracticeGenus,
  startRound,
  TRACKS,
  trackAvailable,
  utcDateKey,
} from "../state/dailyGenus.js";
import type {
  GameData,
  GameTaxon,
  Guess,
  OccurrenceVerdict,
  Rejection,
  Round,
  RoundMode,
  TimeVerdict,
  Track,
} from "../state/dailyGenus.js";
import {
  browserStore,
  loadRecord,
  loadRound,
  loadTrack,
  recordRound,
  saveRecord,
  saveRound,
  saveTrack,
  shareSummary,
} from "../state/dailyGenusStorage.js";
import type {
  KeyValueStore,
  StoredRecord,
} from "../state/dailyGenusStorage.js";
import { layoutCladogram } from "../state/cladogramLayout.js";
import type {
  CladogramLayout,
  CladogramRow,
} from "../state/cladogramLayout.js";
import { cladeMarkerForTaxon } from "./mapCladeMarkers.js";
import { ErrorState } from "./states.js";
import styles from "./dailyGenus.module.css";

/** Injected so tests drive the clock and the draw (NFR-004, REQ-010). */
export interface DailyGenusScreenProps {
  api: ReadApi;
  onOpenProfile: (taxonId: string) => void;
  /** Which mode to open in (REQ-012 addressability). */
  mode?: RoundMode;
  onModeChange?: (mode: RoundMode) => void;
  /** Which of the two parallel puzzles to open (SPEC-020 REQ-004/REQ-007). */
  track?: Track;
  onTrackChange?: (track: Track) => void;
  now?: () => Date;
  random?: () => number;
  store?: KeyValueStore | null;
}

const PERIOD_TOKENS: Readonly<Record<string, string>> = {
  Triassic: "var(--color-period-triassic)",
  Jurassic: "var(--color-period-jurassic)",
  Cretaceous: "var(--color-period-cretaceous)",
};

/** Oldest and youngest bounds of the Mesozoic, for the stratigraphic column. */
const COLUMN_MAX_MA = Math.max(...MESOZOIC_STAGES.map((s) => s.startMa));
const COLUMN_MIN_MA = Math.min(...MESOZOIC_STAGES.map((s) => s.endMa));

function periodBounds(period: string): { startMa: number; endMa: number } {
  const stages = MESOZOIC_STAGES.filter((s) => s.period === period);
  return {
    startMa: Math.max(...stages.map((s) => s.startMa)),
    endMa: Math.min(...stages.map((s) => s.endMa)),
  };
}

/** Percentage from the top of the column (oldest at the top). */
function depthPercent(ma: number): number {
  const span = COLUMN_MAX_MA - COLUMN_MIN_MA;
  return ((COLUMN_MAX_MA - ma) / span) * 100;
}

/**
 * The production clock, hoisted to module scope so its identity is stable across
 * renders. As an inline default parameter it was a fresh function every render,
 * and the countdown effect depends on it — so the effect re-ran, set a new
 * millisecond value, re-rendered, and looped without bound ("Maximum update
 * depth exceeded"). Tests still inject their own `now` (NFR-004).
 */
const SYSTEM_NOW = (): Date => new Date();

/**
 * The diagram's two integers (SPEC-025 REQ-002). Both the labels and the SVG
 * connectors are derived from these, so the two can never describe different
 * pictures — which is the defect this render replaces. They are declared here
 * and pushed *into* CSS as custom properties rather than read back out of it:
 * reading computed style would be a measurement, and REQ-002/NFR-003 forbid the
 * render depending on one.
 */
const ROW_PITCH = 21;
const DEPTH_INDENT = 16;
/** Reserve for the longest label, so the scroll region has a real width. */
const MAX_LABEL_PX = 260;
/** REQ-002: one dash pattern everywhere, chosen so the shortest possible lead —
 *  a single indent — still shows three marks. */
const DASH = "3 2";
const STROKE = 1.2;

/** A row's two integers, looked up once and spent by both layers. */
export interface CladogramPlace {
  readonly row: number;
  readonly depth: number;
}

/**
 * Where a row sits, in the coordinate system both layers share. Both
 * coordinates are spent: `top` from the row, `left` from the depth — the indent
 * `.diagram` already budgets for. Without the indent every label started at the
 * trunk's origin and the connectors were drawn straight through the text.
 *
 * Exported, with `cx`, for SPEC-025 NFR-002's browser-free geometry guard.
 */
export function rowStyle(place: CladogramPlace): Record<string, string> {
  return {
    top: `${place.row * ROW_PITCH}px`,
    left: `${place.depth * DEPTH_INDENT}px`,
  };
}

function placeOf(
  layout: CladogramLayout,
  kind: CladogramRow["kind"],
  id: string,
): CladogramPlace {
  const found = layout.rows.find((r) => r.kind === kind && r.id === id);
  return { row: found?.row ?? 0, depth: found?.depth ?? 0 };
}

/** Centre of a row's dot, in diagram coordinates. */
export const cx = (depth: number): number => depth * DEPTH_INDENT + 4;
const cy = (row: number): number => row * ROW_PITCH + ROW_PITCH / 2;

/**
 * Every connector, in one `aria-hidden` layer (SPEC-025 REQ-002). No text, no
 * measurement — each command is arithmetic on a row's `(row, depth)` pair.
 */
function CladogramConnectors({
  layout,
}: {
  layout: CladogramLayout;
}): ReactElement {
  const nodes = layout.rows.filter((r) => r.kind === "node");
  const paths: ReactElement[] = [];

  nodes.forEach((node, i) => {
    // The spine: a solid bar from this node down to its last child's row.
    const children = layout.rows.filter(
      (r) => r.kind === "cut" && r.parentRow === node.row,
    );
    const next = nodes[i + 1];
    const lastRow = Math.max(
      node.row,
      next?.row ?? node.row,
      ...children.map((c) => c.row),
    );
    if (lastRow > node.row) {
      paths.push(
        <line
          key={`spine-${node.row}`}
          x1={cx(node.depth)}
          y1={cy(node.row)}
          x2={cx(node.depth)}
          y2={cy(lastRow)}
          stroke="currentColor"
          strokeWidth={STROKE}
        />,
      );
    }
    // Solid lead across to the next established node.
    if (next) {
      paths.push(
        <line
          key={`lead-${node.row}`}
          x1={cx(node.depth)}
          y1={cy(next.row)}
          x2={cx(next.depth)}
          y2={cy(next.row)}
          stroke="currentColor"
          strokeWidth={STROKE}
        />,
      );
    }
    // Dashed lead out to each branch this node ruled out.
    for (const cut of children) {
      paths.push(
        <line
          key={`cut-${cut.row}`}
          x1={cx(node.depth)}
          y1={cy(cut.row)}
          x2={cx(cut.depth)}
          y2={cy(cut.row)}
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={DASH}
        />,
      );
    }
  });

  // The guess inside each ruled-out branch: a dashed drop, then a dashed lead.
  for (const guess of layout.rows.filter((r) => r.kind === "guess")) {
    const from = guess.cutRow ?? guess.row;
    paths.push(
      <line
        key={`drop-${guess.row}`}
        x1={cx(layout.tipDepth)}
        y1={cy(from)}
        x2={cx(layout.tipDepth)}
        y2={cy(guess.row)}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeDasharray={DASH}
      />,
      <line
        key={`gl-${guess.row}`}
        x1={cx(layout.tipDepth)}
        y1={cy(guess.row)}
        x2={cx(guess.depth)}
        y2={cy(guess.row)}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeDasharray={DASH}
      />,
    );
  }

  return (
    <svg
      className={styles.connectors}
      aria-hidden="true"
      focusable="false"
      width="100%"
      height={layout.rows.length * ROW_PITCH}
    >
      {paths}
    </svg>
  );
}

const TIME_WORDS: Readonly<Record<TimeVerdict, string>> = {
  older: "the answer is older",
  younger: "the answer is younger",
  overlaps: "their ranges overlap",
  unavailable: "no time span recorded — not available",
};

/**
 * The two SPEC-028 clue channels (REQ-004 as amended 2026-08-26).
 *
 * They live in a table of their own, beneath the board — **not** on the tree.
 * The first design put them on each guess's cladogram row, and two things were
 * wrong with that. The marks pushed guess rows past the diagram's label reserve,
 * which put the region into horizontal overflow; because `.diagram` carried an
 * inline height equal to its own content, the scrollbar was laid out inside that
 * height and clipped the last row. And the tree positions a guess by *clade*, so
 * comparing one channel across guesses meant scanning a diagonal.
 *
 * A table is what "let the data structure the layout" means for a per-guess
 * comparison: the tree still owns the clade verdict and the Ma column still owns
 * the time verdict, so nothing here is a restatement.
 *
 * Every verdict is carried by a glyph and by words before it is carried by
 * colour (UX-001), so each row survives with colour removed.
 */

/** Glyph per occurrence verdict: direction by arrow, distance by doubling. */
const OCCURRENCE_MARKS: Readonly<Record<OccurrenceVerdict, string>> = {
  same: "=",
  "more-close": "▲",
  "more-far": "▲▲",
  "fewer-close": "▼",
  "fewer-far": "▼▼",
  unavailable: "",
};

/**
 * The written form of each verdict (UX-002: a count of records in this snapshot,
 * never a claim that the animal was common or rare).
 */
const OCCURRENCE_WORDS: Readonly<Record<OccurrenceVerdict, string>> = {
  same: "same",
  "more-close": "somewhat more",
  "more-far": "far more",
  "fewer-close": "somewhat fewer",
  "fewer-far": "far fewer",
  unavailable: "not recorded",
};

/**
 * The spoken form, for the live region (UX-004). Longer than the table's column
 * values on purpose: the table has a column heading to supply the noun, and a
 * sentence read aloud does not. Still a count of records, never a claim about
 * the animal (UX-002).
 */
const OCCURRENCE_SPOKEN: Readonly<Record<OccurrenceVerdict, string>> = {
  same: "the same number of recorded occurrences",
  "more-close": "somewhat more recorded occurrences",
  "more-far": "far more recorded occurrences",
  "fewer-close": "somewhat fewer recorded occurrences",
  "fewer-far": "far fewer recorded occurrences",
  // Phrased to follow "The answer has …" — except the absent case, which is not
  // a fact about the answer at all and gets its own sentence below.
  unavailable: "",
};

function occurrenceClass(verdict: OccurrenceVerdict): string {
  if (verdict === "same") return styles.markSame ?? "";
  if (verdict === "unavailable") return styles.markMuted ?? "";
  return verdict.endsWith("-close")
    ? (styles.markClose ?? "")
    : (styles.markFar ?? "");
}

/** One guess's countries cell: the shared codes, or why there are none. */
function CountryCell({ guess }: { guess: Guess }): ReactElement {
  if (guess.countryVerdict === "shared") {
    // Plain middot-separated codes — the idiom the map sidebar already uses for
    // locality data. Not chips.
    return <>{guess.sharedCountries.join(" · ")}</>;
  }
  return (
    <span className={styles.markMuted}>
      {guess.countryVerdict === "none" ? "none shared" : "not recorded"}
    </span>
  );
}

/**
 * The per-guess clue table (REQ-004). Renders nothing at all before the first
 * guess — an empty table with headings would be chrome describing an absence.
 */
function ClueTable({
  guesses,
  geographyAvailable,
}: {
  guesses: readonly Guess[];
  geographyAvailable: boolean;
}): ReactElement | null {
  if (guesses.length === 0) return null;
  return (
    <table className={styles.clues}>
      <caption className={styles.cluesCaption}>
        Each guess against the answer
      </caption>
      <thead>
        <tr>
          <th scope="col">Guess</th>
          {geographyAvailable && <th scope="col">Shared countries</th>}
          {/* UX-002: the heading is where the table says what it counts —
              records in this snapshot, never how common the animal was. */}
          <th scope="col">Occurrence records in this snapshot</th>
        </tr>
      </thead>
      <tbody>
        {guesses.map((g) => (
          <tr key={g.taxonId}>
            <th scope="row" className={styles.clueName}>
              {g.scientificName}
            </th>
            {geographyAvailable && (
              <td className={styles.clueCountries}>
                <CountryCell guess={g} />
              </td>
            )}
            <td className={occurrenceClass(g.occurrences)}>
              <span aria-hidden="true">{OCCURRENCE_MARKS[g.occurrences]}</span>
              {g.occurrences !== "unavailable" && " "}
              {OCCURRENCE_WORDS[g.occurrences]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function rejectionMessage(r: Rejection): string {
  switch (r.reason) {
    case "not-a-genus":
      return `${r.taxonName} is not a genus — it is a ${r.detail}. Guess a genus.`;
    case "not-valid":
      return `${r.taxonName} is in the snapshot, but recorded as ${r.detail}, not Valid.`;
    case "out-of-scope":
      return r.detail
        ? `${r.taxonName} sits in ${r.detail} — outside this game.`
        : `${r.taxonName} is outside Dinosauria — not in this atlas.`;
    case "already-guessed":
      return `${r.taxonName} — already guessed.`;
    case "round-over":
      return "This round is over.";
    default:
      return "No genus of that name is in this snapshot.";
  }
}

export function DailyGenusScreen({
  api,
  onOpenProfile,
  mode = "daily",
  onModeChange,
  track: trackProp,
  onTrackChange,
  now = SYSTEM_NOW,
  random = Math.random,
  store,
}: DailyGenusScreenProps): ReactElement {
  const data: GameData = useMemo(
    () =>
      buildGameData(
        api.listTaxa(),
        buildTaxonomyIndex(api.listTaxa()),
        (id) => api.getProfile(id),
        // SPEC-028 REQ-002: the country index, loaded at boot alongside the
        // reference. `countriesFor` answers `[]` when it is absent, which the
        // verdict reads as "not recorded" rather than "no overlap".
        (id) => api.countriesFor(id),
      ),
    [api],
  );

  const storage = useMemo(
    () => (store === undefined ? browserStore() : store),
    [store],
  );
  const [dateKey, setDateKey] = useState(() => utcDateKey(now()));
  const [rolledOver, setRolledOver] = useState(false);
  // The chosen track (SPEC-020 REQ-004): the prop wins when the shell addressed
  // one, otherwise the player's stored preference, otherwise the full track.
  const [chosenTrack, setChosenTrack] = useState<Track>(
    () => trackProp ?? loadTrack(storage),
  );
  const track: Track = trackAvailable(data, chosenTrack) ? chosenTrack : "full";
  const pool = poolForTrack(data, track);
  const [record, setRecord] = useState<StoredRecord>(() =>
    loadRecord(storage, trackProp ?? loadTrack(storage)),
  );
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [query, setQuery] = useState("");
  const [activeOption, setActiveOption] = useState(0);
  const [copied, setCopied] = useState<"idle" | "copied" | "unavailable">(
    "idle",
  );
  // REQ-003: which track's pool size the detail slot is previewing, if any.
  // Hover *and* focus drive it, so it is reachable without a pointer.
  const [trackPreview, setTrackPreview] = useState<Track | null>(null);
  // SPEC-020 AMEND-006: whether the ranking caveat's disclosure is open. Closed
  // on load — the control, not the caveat, is what is always on the surface.
  const [aboutOpen, setAboutOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const dailyAnswerId = useMemo(
    () => selectDailyGenus(dateKey, pool, saltForTrack(track)),
    [dateKey, pool, track],
  );

  /**
   * Rebuild a track's daily round from storage (REQ-011; SPEC-020 REQ-004).
   * Used both before the first paint and when the player switches track, which
   * is what makes a switch non-destructive: each track's round lives in its own
   * storage key, so coming back restores it rather than starting over.
   */
  const restoreDaily = useCallback(
    (
      forTrack: Track,
      forDate: string,
      answerId: string | null,
    ): Round | null => {
      if (!answerId) return null;
      const fresh = startRound("daily", answerId, forDate, forTrack);
      const stored = loadRound(storage, forDate, forTrack);
      if (!stored || stored.answerId !== answerId) return fresh;
      const answer = data.guessableById.get(stored.answerId);
      if (!answer) return fresh;
      let restored = startRound("daily", stored.answerId, forDate, forTrack);
      for (const g of stored.guesses) {
        const guess = data.guessableById.get(g.taxonId);
        if (guess)
          restored = applyGuess(restored, evaluateGuess(guess, answer, data));
      }
      return restored;
    },
    [storage, data],
  );

  // Restore today's round before the first paint so a reload resumes rather
  // than restarting (REQ-011).
  const [round, setRound] = useState<Round | null>(() =>
    mode === "daily" ? restoreDaily(track, dateKey, dailyAnswerId) : null,
  );

  // Practice draws from the *chosen track's* pool (SPEC-020 REQ-004): the option
  // covers practice as well as the daily.
  const startPractice = useCallback(() => {
    const answerId = selectPracticeGenus(
      pool,
      [dailyAnswerId, round?.mode === "practice" ? round.answerId : null],
      random,
    );
    if (answerId) setRound(startRound("practice", answerId, null, track));
    setRejection(null);
    setQuery("");
    onModeChange?.("practice");
  }, [pool, track, dailyAnswerId, random, round, onModeChange]);

  /**
   * Switch track (SPEC-020 REQ-004). Non-destructive: the round being left is
   * already persisted under its own key, and the one being entered is restored
   * from its own — so a player can look at the other puzzle and come back.
   */
  const chooseTrack = useCallback(
    (next: Track) => {
      if (next === track) return;
      setChosenTrack(next);
      saveTrack(storage, next);
      setRecord(loadRecord(storage, next));
      setRejection(null);
      setQuery("");
      setCopied("idle");
      const nextPool = poolForTrack(data, next);
      if (mode === "practice") {
        const answerId = selectPracticeGenus(
          nextPool,
          [selectDailyGenus(dateKey, nextPool, saltForTrack(next))],
          random,
        );
        setRound(
          answerId ? startRound("practice", answerId, null, next) : null,
        );
      } else {
        setRound(
          restoreDaily(next, dateKey, selectDailyGenus(dateKey, nextPool)),
        );
      }
      onTrackChange?.(next);
    },
    [track, storage, data, dateKey, mode, random, restoreDaily, onTrackChange],
  );

  // The shell addressed a track by fragment: follow it.
  useEffect(() => {
    if (trackProp && trackProp !== chosenTrack) chooseTrack(trackProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackProp]);

  // Opening straight into practice (`#practice`) needs a round on first paint.
  useEffect(() => {
    if (mode === "practice" && (!round || round.mode !== "practice"))
      startPractice();
    // Only on a mode change: startPractice closes over the current round, and
    // re-running on every round change would restart practice after each guess.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Countdown to the next 00:00 UTC. Recomputed from the clock on every tick, so
  // a backgrounded tab resumes correct rather than drifting (REQ-009).
  const [remaining, setRemaining] = useState(() => msUntilNextUtcDay(now()));
  useEffect(() => {
    const tick = (): void => {
      const instant = now();
      setRemaining(msUntilNextUtcDay(instant));
      // The UTC date moved while the screen was open: never swap the answer
      // under the player — offer the new round instead (REQ-013).
      if (utcDateKey(instant) !== dateKey) setRolledOver(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [now, dateKey]);

  const answer: GameTaxon | undefined = round
    ? data.guessableById.get(round.answerId)
    : undefined;
  const finished = round !== null && round.outcome !== "playing";

  // Persist after every change, and fold a finished daily into the record once.
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!round || round.mode !== "daily") return;
    saveRound(storage, round);
    const stamp = `${round.track}:${round.dateKey}`;
    if (round.outcome === "playing" || recordedRef.current === stamp) return;
    recordedRef.current = stamp;
    setRecord((current) => {
      const next = recordRound(current, round);
      saveRecord(storage, next, round.track);
      return next;
    });
  }, [round, storage]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return data.guessable
      .filter((t) => t.scientificName.toLowerCase().startsWith(q))
      .slice(0, 8);
  }, [query, data.guessable]);

  const submit = useCallback(
    (name: string) => {
      if (!round || !answer || round.outcome !== "playing") return;
      const resolution = resolveGuess(
        name,
        data,
        api.listTaxa(),
        round.guesses.map((g) => g.taxonId),
      );
      if (!resolution.ok) {
        setRejection(resolution.rejection);
        return;
      }
      setRejection(null);
      setQuery("");
      setActiveOption(0);
      setRound(
        applyGuess(round, evaluateGuess(resolution.taxon, answer, data)),
      );
    },
    [round, answer, data, api],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveOption((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveOption((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const copy = (): void => {
    if (!round) return;
    const text = shareSummary(round);
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) {
      setCopied("unavailable");
      return;
    }
    clipboard.writeText(text).then(
      () => setCopied("copied"),
      () => setCopied("unavailable"),
    );
  };

  // ── States that pre-empt the board ────────────────────────────────────────
  if (data.pool.length < MIN_POOL_SIZE) {
    return (
      <div className={styles.screen}>
        <ErrorState
          message={`No puzzle today. The classification snapshot yielded ${data.pool.length} usable genera, below the ${MIN_POOL_SIZE} needed to build a fair round, so no genus was chosen. This is a data problem, not a wrong guess.`}
        />
      </div>
    );
  }
  if (!round || !answer) {
    return (
      <div className={styles.screen}>
        <ErrorState message="No puzzle could be built from this snapshot." />
      </div>
    );
  }

  const tree = revealedTree(round, data);
  const layout = layoutCladogram(tree);
  // REQ-007: the guesses the column cannot plot, named once beneath it.
  const noSpanGuesses = round.guesses
    .filter((g) => !data.guessableById.get(g.taxonId)?.timeSpan)
    .map((g) => g.scientificName);
  const snapshotDate = api.metadata().retrievedOn;
  const popularityWindow = api.metadata().popularity?.window ?? null;
  const practice = round.mode === "practice";
  // UX-003: with no index loaded there is no country channel to draw, and the
  // screen says so rather than rendering "not recorded" against every guess.
  const geographyAvailable = api.hasGeography();

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>
            {practice
              ? "Dinordle · practice"
              : `Dinordle · No. ${puzzleNumber(dateKey)}`}
          </p>
          <p className={styles.progress}>
            {finished
              ? round.outcome === "won"
                ? `Solved in ${round.guesses.length} of ${MAX_GUESSES}`
                : `Not solved · ${MAX_GUESSES} of ${MAX_GUESSES} used`
              : `${round.guesses.length} of ${MAX_GUESSES} guesses`}
          </p>
        </div>
        {/* SPEC-020 AMEND-006: the track option sits on the header row, which
            is where the owner asked for it and what recovers the vertical space
            the old block cost above the board. */}
        {trackAvailable(data, "wellKnown") && (
          <div className={styles.tracks}>
            {/* REQ-001: two controls, the domain names, single-choice. `radio`
                roles rather than a fieldset of labels: the same semantics in a
                third of the copy. */}
            <div
              className={styles.trackGroup}
              role="radiogroup"
              aria-label="Which puzzle"
            >
              {TRACKS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={track === option}
                  aria-describedby={`${listId}-track-detail`}
                  className={`${styles.trackButton} ${track === option ? styles.trackButtonOn : ""}`}
                  onClick={() => chooseTrack(option)}
                  onMouseEnter={() => setTrackPreview(option)}
                  onMouseLeave={() => setTrackPreview(null)}
                  onFocus={() => setTrackPreview(option)}
                  onBlur={() => setTrackPreview(null)}
                >
                  {option === "full" ? "Every genus" : "Well-known"}
                </button>
              ))}
            </div>
            {/* SPEC-020 AMEND-006: the ranking caveat now sits behind this
                control. A real `button` toggling a real element — never a
                `title`, never hover-only — so it is reachable by keyboard and on
                a touch device with no hover. The control is rendered in every
                state the track option is, so the caveat is always one deliberate
                action away. */}
            <button
              type="button"
              className={styles.aboutToggle}
              aria-expanded={aboutOpen}
              aria-controls={`${listId}-track-about`}
              onClick={() => setAboutOpen((open) => !open)}
            >
              <span aria-hidden="true">ⓘ</span>
              <span className="visuallyHidden">
                About the “well-known” ranking
              </span>
            </button>
            {/* REQ-003: the pool size for the selected track is always rendered
                here; hovering or focusing the other control previews its size in
                the same slot. Not a live region — this must not be announced on
                every hover — and the slot's height does not change with
                content. */}
            <p className={styles.trackDetail} id={`${listId}-track-detail`}>
              {(trackPreview ?? track) === "full"
                ? `all ${data.pool.length.toLocaleString("en-GB")} genera in the snapshot`
                : `the ${data.wellKnownPool.length} most read about`}
            </p>
          </div>
        )}
        <div className={styles.headRight}>
          <p className={styles.countdown}>{formatCountdown(remaining)}</p>
          <p className={styles.countdownLabel}>next puzzle · 00:00 UTC</p>
        </div>
      </header>

      {/* The disclosure itself. Its wording is unchanged from the always-visible
          version SPEC-020 UX-001/UX-002 require: English Wikipedia, the window,
          how often people read the article, and attention rather than scientific
          importance. Only its reachability changed (AMEND-006). */}
      {trackAvailable(data, "wellKnown") && aboutOpen && (
        <p className={styles.trackAbout} id={`${listId}-track-about`}>
          “Well-known” ranks genera by how often people read their article on
          English Wikipedia
          {popularityWindow ? ` over ${popularityWindow}` : ""} — a measure of
          attention, not of scientific importance.
        </p>
      )}

      {practice && (
        <p className={styles.practiceBanner} role="status">
          Practice — not today’s puzzle. Nothing here is recorded, and it never
          draws today’s genus.
        </p>
      )}

      {rolledOver && !practice && (
        <p className={styles.rollover} role="status">
          A new puzzle is available. This round is unaffected — start the new
          one when you are ready.{" "}
          <button
            type="button"
            className={styles.linkAction}
            onClick={() => {
              const key = utcDateKey(now());
              const next = selectDailyGenus(key, pool, saltForTrack(track));
              setDateKey(key);
              setRolledOver(false);
              recordedRef.current = null;
              if (next) setRound(startRound("daily", next, key));
            }}
          >
            Start today’s puzzle
          </button>
        </p>
      )}

      <div className={styles.board}>
        <section className={styles.treeWrap} aria-labelledby={`${listId}-tree`}>
          <h2 className={styles.eyebrow} id={`${listId}-tree`}>
            Taxonomic tree
          </h2>
          {/* UX-001: one line per label, never wrapped or truncated; the region
              scrolls horizontally with the trunk's origin at its left edge, so
              the spine stays visible while the eliminations scroll into view. */}
          <div
            className={styles.diagram}
            role="region"
            aria-label="Cladogram"
            // A scrollable region must be keyboard-reachable or its content is
            // unreachable without a pointer (WCAG 2.1.1); a focusable region
            // with an accessible name is the standard pattern for that, and the
            // rule does not model it.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            {/* The sized canvas is an *inner* element, so a horizontal scrollbar
                is laid out under it rather than inside its height. With the
                height on the scrolling element itself, any overflow put the
                scrollbar inside the content box and `overflow-y: hidden` clipped
                the last row — the tree was cut off vertically by its own
                scrollbar (SPEC-028 AMEND-001's Reason). */}
            <div
              className={styles.canvas}
              style={
                {
                  "--row-pitch": `${ROW_PITCH}px`,
                  "--depth-indent": `${DEPTH_INDENT}px`,
                  height: `${layout.rows.length * ROW_PITCH}px`,
                  width: `${(layout.guessDepth + 1) * DEPTH_INDENT + MAX_LABEL_PX}px`,
                } as Record<string, string | number>
              }
            >
              <CladogramConnectors layout={layout} />
              {/* UX-002: the accessible structure is the one the screen already
                shipped — trunk nodes root-first, each with the branches ruled out
                at it nested under it, and the guess nested under its branch. Rows
                are *positioned* by CSS; DOM order is still reading order. */}
              <ol className={styles.trunk}>
                {tree.trunk.map((node) => {
                  const nodePlace = placeOf(layout, "node", node.id);
                  return (
                    <li key={node.id} className={styles.trunkItem}>
                      <span
                        className={`${styles.row} ${node.frontier ? styles.frontier : ""}`}
                        style={rowStyle(nodePlace)}
                      >
                        {/* Tint reinforces the clade the same way it does on the
                          map (charter §4); the name carries identity first. */}
                        <span
                          className={styles.dot}
                          style={
                            {
                              "--clade-tint": cladeMarkerForTaxon(
                                node.id,
                                data.index.byId,
                              ).tint,
                            } as Record<string, string>
                          }
                          aria-hidden="true"
                        />
                        <span className={styles.nodeName}>{node.name}</span>
                        <span className={styles.rank}>
                          {node.rank.toLowerCase()}
                        </span>
                        {node.frontier && (
                          <span className={styles.deepest}>
                            deepest reached
                          </span>
                        )}
                        {/* The guess that reached this depth, unless one of this
                          node's own eliminations already names it. */}
                        {node.frontier &&
                          node.reachedBy &&
                          !node.ruledOut.some(
                            (cut) => cut.by === node.reachedBy,
                          ) && (
                            <span className={styles.reached}>
                              ◂ {node.reachedBy}
                            </span>
                          )}
                        <span className="visuallyHidden">
                          {node.frontier
                            ? " — established ancestor, the deepest reached so far"
                            : " — established ancestor"}
                        </span>
                      </span>
                      {node.ruledOut.length > 0 && (
                        <ul className={styles.cuts}>
                          {node.ruledOut.map((cut) => {
                            const cutPlace = placeOf(layout, "cut", cut.id);
                            const ownGuess = cut.name === cut.by;
                            return (
                              <li key={cut.id} className={styles.cutItem}>
                                <span
                                  className={`${styles.row} ${styles.ruledOut}`}
                                  style={rowStyle(cutPlace)}
                                >
                                  <span
                                    className={styles.ringDot}
                                    aria-hidden="true"
                                  />
                                  <span className={styles.nodeName}>
                                    {cut.name}
                                  </span>
                                  <span className="visuallyHidden">
                                    {` — ruled out by the guess ${cut.by}`}
                                  </span>
                                </span>
                                {/* REQ-003: the guess is a leaf inside the branch
                                  it eliminated — taxonomically true, since the
                                  branch is an ancestor-or-self of the guess. When
                                  they are the same taxon the row above already is
                                  the guess, so there is no second row. */}
                                {!ownGuess && (
                                  <ul className={styles.cuts}>
                                    <li className={styles.cutItem}>
                                      <span
                                        className={`${styles.row} ${styles.ruledOut}`}
                                        style={rowStyle(
                                          placeOf(
                                            layout,
                                            "guess",
                                            `${cut.id}:${cut.by}`,
                                          ),
                                        )}
                                      >
                                        <span
                                          className={styles.ringDot}
                                          aria-hidden="true"
                                        />
                                        <span className={styles.nodeName}>
                                          {cut.by}
                                        </span>
                                        <span className="visuallyHidden">
                                          {
                                            " — your guess, inside the branch it ruled out"
                                          }
                                        </span>
                                      </span>
                                    </li>
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* REQ-004: exactly three entries, always visible, worded as the owner
              asked. The unresolved continuation and its entry are both gone. */}
          <p className={styles.key}>
            <span className={styles.keyDot} aria-hidden="true" /> ancestor
            <span className={styles.keyRingTeal} aria-hidden="true" /> closest
            relative
            <span className={styles.keyRing} aria-hidden="true" /> guess
          </p>
        </section>

        <section className={styles.column} aria-labelledby={`${listId}-time`}>
          <h2 className={styles.eyebrow} id={`${listId}-time`}>
            Ma
          </h2>
          <div className={styles.columnBody}>
            {/* The scale, without which this is decoration rather than an axis:
                the period boundaries in Ma, and the period each band is. */}
            <div className={styles.ticks} aria-hidden="true">
              {[
                COLUMN_MAX_MA,
                ...MESOZOIC_PERIODS.map((p) => periodBounds(p).endMa),
              ].map((ma) => (
                <span
                  key={ma}
                  className={styles.tick}
                  style={{ top: `${depthPercent(ma)}%` }}
                >
                  {Math.round(ma)}
                </span>
              ))}
            </div>
            <div className={styles.bands} aria-hidden="true">
              {MESOZOIC_PERIODS.map((period) => {
                const { startMa, endMa } = periodBounds(period);
                const top = depthPercent(startMa);
                return (
                  <span
                    key={period}
                    className={styles.band}
                    style={{
                      top: `${top}%`,
                      height: `${depthPercent(endMa) - top}%`,
                      background: PERIOD_TOKENS[period],
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.periodNames} aria-hidden="true">
              {MESOZOIC_PERIODS.map((period) => {
                const { startMa, endMa } = periodBounds(period);
                const top = depthPercent(startMa);
                return (
                  <span
                    key={period}
                    className={styles.periodName}
                    style={{ top: `${(top + depthPercent(endMa)) / 2}%` }}
                  >
                    {period}
                  </span>
                );
              })}
            </div>
            <ul className={styles.bars}>
              {round.guesses.map((g, i) => {
                const span =
                  data.guessableById.get(g.taxonId)?.timeSpan ?? null;
                const top = span ? depthPercent(span.maxMa) : 0;
                const height = span ? depthPercent(span.minMa) - top : 0;
                // REQ-005: overlap is solid, a miss is hollow. The difference is
                // a shape, not just a colour, so it survives with colour removed.
                const overlaps = g.time === "overlaps";
                return (
                  <li key={g.taxonId} className={styles.barSlot}>
                    {span && (
                      <span
                        className={`${styles.bar} ${overlaps ? styles.barOverlaps : styles.barMisses}`}
                        style={{ top: `${top}%`, height: `${height}%` }}
                        aria-hidden="true"
                      >
                        {/* REQ-006: a miss points along the axis toward where the
                            answer actually lies. An overlap has nowhere to point. */}
                        {!overlaps && (
                          <span
                            className={`${styles.barMark} ${
                              g.time === "older"
                                ? styles.barMarkOlder
                                : styles.barMarkYounger
                            }`}
                          >
                            {g.time === "older" ? "▲" : "▼"}
                          </span>
                        )}
                      </span>
                    )}
                    {/* REQ-007: no span means no bar — there is no extent to plot
                        and none may be invented — but the slot is still marked, so
                        the guess never silently vanishes from the column. */}
                    {!span && (
                      <span className={styles.barMissing} aria-hidden="true">
                        ✕
                      </span>
                    )}
                    <span className="visuallyHidden">
                      {`Guess ${i + 1}, ${g.scientificName}: ${TIME_WORDS[g.time]}.`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          {/* SPEC-024 REQ-006 as amended by AMEND-001: three entries, not four.
              The ✕ treatment keeps its mark on the column and its sentence
              beneath, so it is the one entry a key line does not also need. */}
          <p className={styles.timeKey}>
            <span
              className={`${styles.keyBar} ${styles.barOverlaps}`}
              aria-hidden="true"
            />{" "}
            overlaps
            <span
              className={`${styles.keyBar} ${styles.barMisses}`}
              aria-hidden="true"
            />
            ▲ answer older
            <span
              className={`${styles.keyBar} ${styles.barMisses}`}
              aria-hidden="true"
            />
            ▼ answer younger
          </p>
          {noSpanGuesses.length > 0 && (
            <p className={styles.noSpanNote}>
              {noSpanGuesses.length === 1
                ? `${noSpanGuesses[0]} has no time span recorded, so it is not plotted.`
                : `${noSpanGuesses.join(", ")} have no time span recorded, so they are not plotted.`}
            </p>
          )}
        </section>
      </div>

      {/* SPEC-028 REQ-004 (amended): the two clue channels, in their own table.
          Deliberately outside `.board` — they are per-guess facts, not part of
          the tree or the Ma column, and keeping them off the diagram is what
          restores the row widths SPEC-025 sized. */}
      <ClueTable
        guesses={round.guesses}
        geographyAvailable={geographyAvailable}
      />
      {!geographyAvailable && round.guesses.length > 0 && (
        <p className={styles.noSpanNote}>
          Countries of occurrence are unavailable — the geography index did not
          load, so that clue is withheld rather than guessed at.
        </p>
      )}

      {finished ? (
        <section className={styles.reveal} aria-live="polite">
          <p className={styles.revealName}>{answer.scientificName}</p>
          <p className={styles.revealMeta}>
            {answer.rank.toLowerCase()}
            {answer.timeSpan
              ? ` · ${answer.timeSpan.maxMa}–${answer.timeSpan.minMa} Ma`
              : " · time span not available"}
          </p>
          <p className={styles.revealLineage}>
            {data.index
              .ancestors(answer.id)
              .map((t) => t.scientificName)
              .join(" › ")}
          </p>
          {/* SPEC-021 REQ-003: the snapshot date joins the line that already
              names the authority, so the reveal — the moment the game asserts a
              placement — still says what that placement rests on (SPEC-019
              UX-004). It used to sit in the screen footer, now deleted. */}
          <p className={styles.revealSource}>
            {answer.acceptedPer
              ? `accepted per ${answer.acceptedPer}`
              : "accepted name — source not available"}
            {` · PBDB snapshot ${snapshotDate}`}
          </p>
          {answer.silhouette && (
            <img
              className={styles.revealSilhouette}
              src={answer.silhouette}
              alt={`Silhouette of ${answer.scientificName}`}
            />
          )}
          <p className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => onOpenProfile(answer.id)}
            >
              Open taxon page
            </button>
            {!practice && (
              <button
                type="button"
                className={styles.linkAction}
                onClick={copy}
              >
                Copy result
              </button>
            )}
            <button
              type="button"
              className={styles.linkAction}
              onClick={startPractice}
            >
              Practice round
            </button>
          </p>
          {copied === "copied" && (
            <p className={styles.note} role="status">
              Result copied.
            </p>
          )}
          {copied === "unavailable" && (
            <p className={styles.note} role="status">
              Copy is unavailable — your result:{" "}
              <code>{shareSummary(round)}</code>
            </p>
          )}
          {!practice && (
            <p className={styles.record}>
              played {record.played} · solved {record.won} · streak{" "}
              {record.streak} · best {record.bestStreak}
            </p>
          )}
        </section>
      ) : (
        <section className={styles.entry}>
          <label className={styles.entryLabel} htmlFor={`${listId}-guess`}>
            Guess a genus
          </label>
          <div className={styles.entryRow}>
            <span className={styles.caret} aria-hidden="true">
              ▸
            </span>
            <input
              ref={inputRef}
              id={`${listId}-guess`}
              className={styles.entryInput}
              type="text"
              autoComplete="off"
              placeholder="type a genus"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={`${listId}-options`}
              aria-autocomplete="list"
              aria-activedescendant={
                suggestions[activeOption]
                  ? `${listId}-option-${activeOption}`
                  : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveOption(0);
              }}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className={styles.enter}
              onClick={() =>
                submit(suggestions[activeOption]?.scientificName ?? query)
              }
            >
              ↵ guess
            </button>
          </div>
          {suggestions.length > 0 && (
            <ul
              className={styles.options}
              id={`${listId}-options`}
              role="listbox"
            >
              {suggestions.map((t, i) => (
                <li
                  key={t.id}
                  id={`${listId}-option-${i}`}
                  role="option"
                  aria-selected={i === activeOption}
                  className={`${styles.option} ${i === activeOption ? styles.optionActive : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit(t.scientificName);
                  }}
                  onMouseEnter={() => setActiveOption(i)}
                >
                  {t.scientificName}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.entryNote}>
            genera only · {data.guessable.length.toLocaleString("en-GB")}{" "}
            guessable
          </p>
          {rejection && (
            <p className={styles.rejection} role="alert">
              {rejectionMessage(rejection)}
            </p>
          )}
          <p className={styles.aside}>
            {!practice && (
              <button
                type="button"
                className={styles.linkAction}
                onClick={startPractice}
              >
                Practice round
              </button>
            )}
          </p>
          <p aria-live="polite" className="visuallyHidden">
            {round.guesses.length > 0 &&
              (() => {
                const last = round.guesses[round.guesses.length - 1]!;
                // SPEC-028 UX-004: the announcement names both new verdicts as
                // well, so a screen-reader player gets every channel the sighted
                // row carries.
                const countries =
                  !geographyAvailable || last.countryVerdict === "unavailable"
                    ? ""
                    : last.countryVerdict === "shared"
                      ? ` Also found in ${last.sharedCountries.join(", ")}.`
                      : " No shared country.";
                return `${last.scientificName}: deepest shared clade ${last.sharedName}, ${last.sharedRank.toLowerCase()}. ${
                  last.ruledOutName && last.ruledOutName !== last.scientificName
                    ? `${last.ruledOutName} is ruled out. `
                    : ""
                }${TIME_WORDS[last.time]}.${countries}${
                  last.occurrences === "unavailable"
                    ? " Occurrences not recorded."
                    : ` The answer has ${OCCURRENCE_SPOKEN[last.occurrences]}.`
                }`;
              })()}
          </p>
        </section>
      )}

      {/* SPEC-021 UX-005: the provenance line moved to the reveal (REQ-003), so
          the footer now has only a conditional child — it must not render at all
          when storage works, or it leaves an empty bordered bar under the board. */}
      {!storage && (
        <footer className={styles.foot}>
          <span className={styles.note}>
            Progress will not be kept — this browser blocks local storage. You
            can finish this round, but a reload starts it over.
          </span>
        </footer>
      )}
    </div>
  );
}
