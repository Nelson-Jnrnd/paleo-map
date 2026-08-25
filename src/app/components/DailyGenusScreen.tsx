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
 * the terminal — so there is no separate guess list, because the guesses *are*
 * the branches. Time is a stratigraphic column rather than a badge per guess.
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
  HINT_AFTER_GUESSES,
  MAX_GUESSES,
  MIN_POOL_SIZE,
  applyGuess,
  buildGameData,
  evaluateGuess,
  formatCountdown,
  hintAvailable,
  msUntilNextUtcDay,
  poolForTrack,
  puzzleNumber,
  resolveGuess,
  revealedTree,
  saltForTrack,
  selectDailyGenus,
  selectPracticeGenus,
  startRound,
  takeHint,
  TRACKS,
  trackAvailable,
  utcDateKey,
} from "../state/dailyGenus.js";
import type {
  GameData,
  GameTaxon,
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


const TIME_WORDS: Readonly<Record<TimeVerdict, string>> = {
  older: "the answer is older",
  younger: "the answer is younger",
  overlaps: "their ranges overlap",
  unavailable: "no time span recorded — not available",
};

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
  now = () => new Date(),
  random = Math.random,
  store,
}: DailyGenusScreenProps): ReactElement {
  const data: GameData = useMemo(
    () =>
      buildGameData(api.listTaxa(), buildTaxonomyIndex(api.listTaxa()), (id) =>
        api.getProfile(id),
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
      return stored.hintUsed ? { ...restored, hintUsed: true } : restored;
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
        <ErrorState
          message="No puzzle could be built from this snapshot."
        />
      </div>
    );
  }

  const tree = revealedTree(round, data);
  // REQ-007: the guesses the column cannot plot, named once beneath it.
  const noSpanGuesses = round.guesses
    .filter((g) => !data.guessableById.get(g.taxonId)?.timeSpan)
    .map((g) => g.scientificName);
  const snapshotDate = api.metadata().retrievedOn;
  const popularityWindow = api.metadata().popularity?.window ?? null;
  const practice = round.mode === "practice";

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
        <div className={styles.headRight}>
          <p className={styles.countdown}>{formatCountdown(remaining)}</p>
          <p className={styles.countdownLabel}>next puzzle · 00:00 UTC</p>
        </div>
      </header>

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
          {/* REQ-003: the pool size for the selected track is always rendered
              here; hovering or focusing the other control previews its size in
              the same slot. Not a live region — this must not be announced on
              every hover — and the slot's height does not change with content. */}
          <p className={styles.trackDetail} id={`${listId}-track-detail`}>
            {(trackPreview ?? track) === "full"
              ? `all ${data.pool.length.toLocaleString("en-GB")} genera in the snapshot`
              : `the ${data.wellKnownPool.length} most read about`}
          </p>
          {/* REQ-002: this is provenance, not detail. It states what the ranking
              is built from and what it is not, so the charter forbids putting it
              behind a hover, a title or a disclosure. It stays visible for both
              tracks, in every state. */}
          <p className={styles.trackAbout}>
            “Well-known” ranks genera by how often people read their article on
            English Wikipedia
            {popularityWindow ? ` over ${popularityWindow}` : ""} — a measure of
            attention, not of scientific importance.
          </p>
        </div>
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
          <ol className={styles.trunk}>
            {tree.trunk.map((node, depth) => (
              <li
                key={node.id}
                className={`${styles.node} ${node.frontier ? styles.frontier : ""}`}
                style={{ "--depth": depth } as Record<string, number>}
              >
                <span className={styles.nodeRow}>
                  {/* Tint reinforces the clade the same way it does on the map
                      (charter §4); the name always carries identity first. */}
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
                  <span className={styles.rank}>{node.rank.toLowerCase()}</span>
                  {/* The guess that reached this depth, unless one of this
                      node's own eliminations already names it — the branch a
                      guess ruled out hangs from the very clade it established,
                      so labelling both prints the same name twice on one row. */}
                  {node.frontier &&
                    node.reachedBy &&
                    !node.ruledOut.some((cut) => cut.by === node.reachedBy) && (
                      <span className={styles.reached}>◂ {node.reachedBy}</span>
                    )}
                  <span className="visuallyHidden">
                    {node.frontier
                      ? " — established ancestor, the deepest reached so far"
                      : " — established ancestor"}
                  </span>
                </span>
                {node.ruledOut.length > 0 && (
                  <ul className={styles.cuts}>
                    {node.ruledOut.map((cut) => (
                      <li key={cut.id} className={styles.cut}>
                        <span className={styles.cutMark} aria-hidden="true">
                          ✕
                        </span>
                        <s className={styles.cutName}>{cut.name}</s>
                        {cut.name !== cut.by && (
                          <span className={styles.cutBy}>◂ {cut.by}</span>
                        )}
                        <span className="visuallyHidden">
                          {` — ruled out by the guess ${cut.by}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>

          {tree.unresolved && (
            <p
              className={styles.unresolved}
              style={{ "--depth": tree.trunk.length } as Record<string, number>}
            >
              <span aria-hidden="true">?</span> the descent continues — how far
              is not stated
            </p>
          )}

          <p className={styles.key}>
            <span className={styles.keyDot} aria-hidden="true" /> established
            <span className={styles.keySep} aria-hidden="true" />✕ ruled out
            <span className={styles.keySep} aria-hidden="true" />⋯ unresolved
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
                          <span className={styles.barMark}>
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
          {/* REQ-006: one entry per treatment, in words — the same
              three-marks-three-words shape the tree's key uses. */}
          <p className={styles.timeKey}>
            <span className={`${styles.keyBar} ${styles.barOverlaps}`} aria-hidden="true" />{" "}
            overlaps
            <span className={styles.keySep} aria-hidden="true" />
            <span className={`${styles.keyBar} ${styles.barMisses}`} aria-hidden="true" />▲
            answer older
            <span className={styles.keySep} aria-hidden="true" />
            <span className={`${styles.keyBar} ${styles.barMisses}`} aria-hidden="true" />▼
            answer younger
            <span className={styles.keySep} aria-hidden="true" />✕ no span recorded
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
            {hintAvailable(round) ? (
              <button
                type="button"
                className={styles.linkAction}
                onClick={() => setRound(takeHint(round))}
              >
                Reveal the silhouette
              </button>
            ) : round.hintUsed ? (
              <span className={styles.note}>
                hint used — marked in your result
              </span>
            ) : (
              <span className={styles.note}>
                silhouette hint — from guess {HINT_AFTER_GUESSES}
              </span>
            )}
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
          {round.hintUsed && answer.silhouette && (
            <img
              className={styles.hintSilhouette}
              src={answer.silhouette}
              alt="Silhouette of the hidden genus"
            />
          )}
          <p aria-live="polite" className="visuallyHidden">
            {round.guesses.length > 0 &&
              (() => {
                const last = round.guesses[round.guesses.length - 1]!;
                return `${last.scientificName}: deepest shared clade ${last.sharedName}, ${last.sharedRank.toLowerCase()}. ${
                  last.ruledOutName && last.ruledOutName !== last.scientificName
                    ? `${last.ruledOutName} is ruled out. `
                    : ""
                }${TIME_WORDS[last.time]}.`;
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
