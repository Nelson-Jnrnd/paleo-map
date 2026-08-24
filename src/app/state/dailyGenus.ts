/**
 * Dinordle — the pure core (SPEC-019; named "Daily Genus" until SPEC-022). No
 * React, no clock, no storage, no
 * network: every function here takes what it needs as an argument, so the whole
 * game is unit-testable without a DOM and CI never depends on the wall clock
 * (NFR-004).
 *
 * The mechanic: a guess is always a *genus*; what comes back is the deepest
 * clade that genus shares with the hidden one, plus the branch that share rules
 * out. Neither the answer's depth nor the distance remaining is ever produced —
 * owner decision of 2026-08-08, so working out how specific the answer is stays
 * part of the puzzle (REQ-004). `relatedness()` does return step counts; this
 * module deliberately consumes them only to order guesses, and never re-exports
 * them.
 *
 * Tree work reuses SPEC-017's `buildTaxonomyIndex` and `relatedness` rather than
 * forking a second traversal (API-001), which also gives NFR-002's indexed
 * lookups for free.
 */

import type { ReadProfile, ReadTaxon, TimeRange } from "../../domain/index.js";
import { relatedness } from "./taxonomy.js";
import type { TaxonomyIndex } from "./taxonomy.js";

/** Guesses per round (REQ-007). One constant, so a change is one line. */
export const MAX_GUESSES = 8;
/** Unsuccessful guesses before the silhouette hint is offered (REQ-008). */
export const HINT_AFTER_GUESSES = 5;
/** The pool floor below which the game refuses to start (REQ-002). */
export const MIN_POOL_SIZE = 500;

/**
 * Which puzzle a player is on (SPEC-020 REQ-003). Two dailies run in parallel:
 * `full` over every eligible genus, `wellKnown` over the ones people actually
 * look up. A track is a different *pool*, never a different algorithm — within
 * either, selection stays SPEC-019's uniform permutation.
 */
export type Track = "full" | "wellKnown";

export const TRACKS: readonly Track[] = ["full", "wellKnown"];

/** How many genera the well-known track holds (SPEC-020 REQ-002). */
export const WELL_KNOWN_POOL_SIZE = 250;
/** Below this the well-known track is withheld rather than shipped degraded. */
export const MIN_WELL_KNOWN_POOL = 180;

/**
 * The UTC date that is puzzle No. 1 (Configuration impact). Set once at first
 * release and never moved: it is baked into every shared result, so changing it
 * renumbers every player's history.
 */
export const PUZZLE_EPOCH_UTC = "2026-08-11";

const MS_PER_DAY = 86_400_000;

// ─────────────────────────────────────────────────────────────────────────────
// UTC day boundary (REQ-001, REQ-009, REQ-013)
// ─────────────────────────────────────────────────────────────────────────────

/** The UTC calendar date of an instant, as `YYYY-MM-DD`. Never local time. */
export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Whole days from the epoch to a `YYYY-MM-DD` key; negative before it. */
export function puzzleNumber(dateKey: string): number {
  const day = Date.parse(`${dateKey}T00:00:00Z`);
  const epoch = Date.parse(`${PUZZLE_EPOCH_UTC}T00:00:00Z`);
  return Math.round((day - epoch) / MS_PER_DAY) + 1;
}

/**
 * Milliseconds until the next 00:00 UTC (REQ-009). Recomputed from the instant
 * rather than decremented, so a backgrounded tab and a clock that jumps both
 * resolve correctly; a backwards jump yields a longer remainder, never a
 * negative one (Error handling).
 */
export function msUntilNextUtcDay(now: Date): number {
  const next = Date.parse(`${utcDateKey(now)}T00:00:00Z`) + MS_PER_DAY;
  return Math.max(0, next - now.getTime());
}

/** `HH:MM:SS`, zero-padded, for the countdown readout. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// The answer pool (REQ-002, DATA-001)
// ─────────────────────────────────────────────────────────────────────────────

/** What the game needs to know about one taxon, resolved once at screen open. */
export interface GameTaxon {
  readonly id: string;
  readonly scientificName: string;
  readonly rank: string;
  readonly timeSpan: TimeRange | null;
  readonly silhouette: string | null;
  readonly acceptedPer: string | null;
}

export interface GameData {
  readonly index: TaxonomyIndex;
  /** Genera that may be guessed — valid, non-avian, in scope (REQ-003). */
  readonly guessable: readonly GameTaxon[];
  readonly guessableById: ReadonlyMap<string, GameTaxon>;
  /** Ids that may be the answer — the guessable set, further gated (REQ-002). */
  readonly pool: readonly string[];
  /**
   * The well-known track's pool: the same genera ranked by encyclopedic
   * attention and cut at the top N (SPEC-020 REQ-002). Empty when the popularity
   * cache is absent or too sparse, in which case the track is not offered.
   */
  readonly wellKnownPool: readonly string[];
}

type ProfileLookup = (taxonId: string) => ReadProfile | undefined;

/**
 * The guessable set: rank `Genus`, inside `Dinosauria`, outside the avian
 * branches, and `Valid` in the snapshot (REQ-003). Ordered by scientific name so
 * every derivation downstream is byte-stable (SPEC-001 NFR-001).
 */
function deriveGuessable(
  taxa: readonly ReadTaxon[],
  index: TaxonomyIndex,
  profileOf: ProfileLookup,
): GameTaxon[] {
  const out: GameTaxon[] = [];
  for (const t of taxa) {
    if (t.rank !== "Genus") continue;
    if (!index.inScope(t.id) || index.isAvian(t.id)) continue;
    if (t.validity?.value !== "Valid") continue;
    const profile = profileOf(t.id);
    out.push({
      id: t.id,
      scientificName: t.scientificName,
      rank: t.rank,
      timeSpan: profile?.timeSpan ?? null,
      silhouette: profile?.silhouette ?? null,
      acceptedPer: t.acceptedPer ?? null,
    });
  }
  return out.sort((a, b) => a.scientificName.localeCompare(b.scientificName));
}

/**
 * The answer pool: every guessable genus that also carries a silhouette, a time
 * span, a summary and at least one image (REQ-002).
 *
 * **Derived, never curated** (owner decision, 2026-08-08). The gate asks only
 * "is there enough here for a player to recognise the animal when it is
 * revealed" — there is no hand-authored list of famous genera, because the
 * snapshot carries no signal for fame and inventing one would make this module a
 * second source of truth about paleontology's popular canon. The measured
 * consequence is on record in the spec: ~985 entries, of which roughly nine are
 * trace-fossil genera.
 */
export function derivePool(
  guessable: readonly GameTaxon[],
  profileOf: ProfileLookup,
): string[] {
  const out: string[] = [];
  for (const t of guessable) {
    const profile = profileOf(t.id);
    if (!profile) continue;
    if (!profile.silhouette || !profile.timeSpan) continue;
    if (!profile.summary) continue;
    if (profile.images.length === 0) continue;
    out.push(t.id);
  }
  return out;
}

/**
 * The well-known pool (SPEC-020 REQ-002): the answer pool restricted to genera
 * whose popularity is established, ranked by views descending, cut at the top
 * `WELL_KNOWN_POOL_SIZE`. Ties break by scientific name so the cut is
 * deterministic.
 *
 * **A rank cut, not a view threshold.** Absolute counts drift with the window
 * and with public attention, so `views >= N` could yield 200 genera one snapshot
 * and 400 the next — silently changing how well known the track feels. A rank
 * keeps the track a stable size.
 *
 * A genus with `null` popularity is *excluded*, never ranked last: null means
 * the figure was never established, not that nobody reads about it (REQ-001).
 */
export function deriveWellKnownPool(
  pool: readonly string[],
  guessableById: ReadonlyMap<string, GameTaxon>,
  profileOf: ProfileLookup,
): string[] {
  const ranked: { id: string; views: number; name: string }[] = [];
  for (const id of pool) {
    const views = profileOf(id)?.popularity;
    if (typeof views !== "number") continue;
    ranked.push({
      id,
      views,
      name: guessableById.get(id)?.scientificName ?? id,
    });
  }
  ranked.sort((a, b) =>
    b.views !== a.views ? b.views - a.views : a.name.localeCompare(b.name),
  );
  const cut = ranked.slice(0, WELL_KNOWN_POOL_SIZE).map((r) => r.id);
  // Below the floor the track is withheld rather than shipped degraded
  // (REQ-002, REQ-008): a handful of genera is not a daily puzzle.
  return cut.length >= MIN_WELL_KNOWN_POOL ? cut : [];
}

/** Resolve every index the game needs from the loaded model, in one pass. */
export function buildGameData(
  taxa: readonly ReadTaxon[],
  index: TaxonomyIndex,
  profileOf: ProfileLookup,
): GameData {
  const guessable = deriveGuessable(taxa, index, profileOf);
  const guessableById = new Map(guessable.map((t) => [t.id, t]));
  const pool = derivePool(guessable, profileOf);
  return {
    index,
    guessable,
    guessableById,
    pool,
    wellKnownPool: deriveWellKnownPool(pool, guessableById, profileOf),
  };
}

/** The pool a track plays over, and whether that track can be offered at all. */
export function poolForTrack(data: GameData, track: Track): readonly string[] {
  return track === "wellKnown" ? data.wellKnownPool : data.pool;
}

/** The well-known track is offered only when its pool cleared the floor. */
export function trackAvailable(data: GameData, track: Track): boolean {
  return track === "full"
    ? data.pool.length >= MIN_POOL_SIZE
    : data.wellKnownPool.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily selection (REQ-001)
// ─────────────────────────────────────────────────────────────────────────────

/** FNV-1a. Small, dependency-free, and stable across engines and releases. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * A fixed permutation of the pool. Ordering by a salted hash of the taxon id
 * scatters neighbours in the source order (which is alphabetical, so consecutive
 * days would otherwise be *Abelisaurus*, *Achelousaurus*, …) while staying a pure
 * function of the pool itself — no seed to store, no shuffle state to persist.
 */
function permute(pool: readonly string[], salt: string): string[] {
  return [...pool].sort((a, b) => {
    const ha = hash32(`${salt}${a}`);
    const hb = hash32(`${salt}${b}`);
    return ha !== hb ? ha - hb : a.localeCompare(b);
  });
}

/**
 * The permutation salt per track (SPEC-020 REQ-003). The full track keeps the
 * original salt, so its sequence is byte-identical to SPEC-019's (REQ-008).
 *
 * The well-known track needs its *own* salt because it is a subset of the full
 * pool: with a shared salt its order is the full order with non-members removed,
 * so both tracks open on the same genus and stay in step until the first
 * non-member appears — measured on the shipped snapshot, the two tracks were
 * identical on 4 of the first 14 days, including the first four in a row. A
 * player switching tracks on launch day would have seen the option do nothing.
 */
const TRACK_SALT: Readonly<Record<Track, string>> = {
  full: "daily-genus:",
  wellKnown: "daily-genus:well-known:",
};

export function saltForTrack(track: Track): string {
  return TRACK_SALT[track];
}

/**
 * The answer for a UTC date (REQ-001). Pure: same date + same pool → same genus,
 * on every device in every time zone. Walks a fixed permutation, so every entry
 * is used exactly once before any repeats, and day N + poolLength repeats day N.
 */
export function selectDailyGenus(
  dateKey: string,
  pool: readonly string[],
  salt: string = TRACK_SALT.full,
): string | null {
  if (pool.length === 0) return null;
  const order = permute(pool, salt);
  const day = puzzleNumber(dateKey) - 1;
  // JS `%` keeps the sign of the dividend; a clock set before the epoch must
  // still land inside the array (Edge cases).
  const i = ((day % order.length) + order.length) % order.length;
  return order[i]!;
}

/**
 * A practice answer (REQ-010): drawn from the same pool, never today's genus,
 * and never the round just played. `pick` is injected so the caller owns the
 * randomness and tests stay deterministic.
 */
export function selectPracticeGenus(
  pool: readonly string[],
  exclude: readonly (string | null)[],
  pick: () => number,
): string | null {
  const banned = new Set(exclude.filter((id): id is string => Boolean(id)));
  const candidates = pool.filter((id) => !banned.has(id));
  const usable = candidates.length > 0 ? candidates : pool;
  if (usable.length === 0) return null;
  const i = Math.min(
    usable.length - 1,
    Math.max(0, Math.floor(pick() * usable.length)),
  );
  return usable[i]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guess validation (REQ-003)
// ─────────────────────────────────────────────────────────────────────────────

export type RejectionReason =
  | "unknown"
  | "not-a-genus"
  | "not-valid"
  | "out-of-scope"
  | "already-guessed"
  | "round-over";

export interface Rejection {
  readonly reason: RejectionReason;
  /** The taxon the message is about, when one resolved. */
  readonly taxonName: string | null;
  /** The snapshot's own word for why, e.g. a `Synonymous` validity. */
  readonly detail: string | null;
}

export type GuessResolution =
  | { readonly ok: true; readonly taxon: GameTaxon }
  | { readonly ok: false; readonly rejection: Rejection };

/** Fold case and diacritics so "velociraptor" and "Velociráptor" both match. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Resolve typed text to a guessable genus, or say precisely why not (REQ-003).
 * The three rejection reasons are distinct on purpose: a snapshot that records a
 * name as `Synonymous` should say so rather than "not found" — the honesty rule
 * applied to input.
 */
export function resolveGuess(
  input: string,
  data: GameData,
  allTaxa: readonly ReadTaxon[],
  alreadyGuessed: readonly string[],
): GuessResolution {
  const q = normalizeName(input);
  if (q.length === 0) {
    return {
      ok: false,
      rejection: { reason: "unknown", taxonName: null, detail: null },
    };
  }

  const guessable = data.guessable.find(
    (t) => normalizeName(t.scientificName) === q,
  );
  if (guessable) {
    if (alreadyGuessed.includes(guessable.id)) {
      return {
        ok: false,
        rejection: {
          reason: "already-guessed",
          taxonName: guessable.scientificName,
          detail: null,
        },
      };
    }
    return { ok: true, taxon: guessable };
  }

  // Not guessable — find it anyway, so the message can name the real reason.
  const known = allTaxa.find((t) => normalizeName(t.scientificName) === q);
  if (!known) {
    return {
      ok: false,
      rejection: { reason: "unknown", taxonName: null, detail: null },
    };
  }
  if (!data.index.inScope(known.id) || data.index.isAvian(known.id)) {
    return {
      ok: false,
      rejection: {
        reason: "out-of-scope",
        taxonName: known.scientificName,
        detail: data.index.isAvian(known.id) ? "an avian branch" : null,
      },
    };
  }
  if (known.rank !== "Genus") {
    return {
      ok: false,
      rejection: {
        reason: "not-a-genus",
        taxonName: known.scientificName,
        detail: known.rank.toLowerCase(),
      },
    };
  }
  return {
    ok: false,
    rejection: {
      reason: "not-valid",
      taxonName: known.scientificName,
      detail: known.validity?.value ?? null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Time clue (REQ-006)
// ─────────────────────────────────────────────────────────────────────────────

/** Older / younger / overlapping, or an explicit absence — never a blank. */
export type TimeVerdict = "older" | "younger" | "overlaps" | "unavailable";

/**
 * Compare a guess's span with the answer's (REQ-006). "Older" means the answer
 * is older than the guess. Spans that touch at a bound are treated as
 * overlapping, since a shared boundary is a real overlap in stratigraphic terms.
 * A missing span on either side is stated, not guessed at.
 */
export function timeVerdict(
  guess: TimeRange | null,
  answer: TimeRange | null,
): TimeVerdict {
  if (!guess || !answer) return "unavailable";
  if (answer.minMa <= guess.maxMa && guess.minMa <= answer.maxMa)
    return "overlaps";
  return answer.maxMa > guess.maxMa ? "older" : "younger";
}

// ─────────────────────────────────────────────────────────────────────────────
// Guess evaluation and the revealed tree (REQ-004, REQ-005, REQ-014)
// ─────────────────────────────────────────────────────────────────────────────

export interface Guess {
  readonly taxonId: string;
  readonly scientificName: string;
  /** Deepest clade shared with the answer — never a node above `Dinosauria`. */
  readonly sharedId: string;
  readonly sharedName: string;
  readonly sharedRank: string;
  /** Child of the shared clade containing the guess: the branch now ruled out. */
  readonly ruledOutId: string | null;
  readonly ruledOutName: string | null;
  readonly time: TimeVerdict;
  readonly correct: boolean;
  /** Internal only — the shared clade's depth, used to order guesses. Never rendered. */
  readonly sharedDepth: number;
}

/**
 * Evaluate one guess against the answer (REQ-004).
 *
 * The returned shape carries the shared clade and the ruled-out branch, and
 * *no* measure of remaining distance. `sharedDepth` exists so the reducer can
 * tell which guess reached deepest; it is not a distance to the answer and must
 * not be rendered (REQ-004 acceptance criteria).
 */
export function evaluateGuess(
  guess: GameTaxon,
  answer: GameTaxon,
  data: GameData,
): Guess {
  const rel = relatedness(data.index, guess.id, answer.id);
  const rootId = data.index.rootId;
  const shared =
    rel.ancestor ?? (rootId ? (data.index.byId.get(rootId) ?? null) : null);

  const sharedId = shared?.id ?? rootId ?? guess.id;
  const chain = data.index.ancestors(guess.id);
  const sharedAt = chain.findIndex((t) => t.id === sharedId);
  // The child of the shared clade that contains the guess — the branch this
  // guess eliminates. Absent when the guess *is* the shared clade (a win).
  const ruledOut = sharedAt >= 0 ? (chain[sharedAt + 1] ?? null) : null;

  return {
    taxonId: guess.id,
    scientificName: guess.scientificName,
    sharedId,
    sharedName: shared?.scientificName ?? "",
    sharedRank: shared?.rank ?? "",
    ruledOutId: ruledOut?.id ?? null,
    ruledOutName: ruledOut?.scientificName ?? null,
    time: timeVerdict(guess.timeSpan, answer.timeSpan),
    correct: guess.id === answer.id,
    sharedDepth: sharedAt >= 0 ? sharedAt : 0,
  };
}

export type RoundOutcome = "playing" | "won" | "lost";
export type RoundMode = "daily" | "practice";

export interface Round {
  readonly mode: RoundMode;
  /** Which of the two parallel puzzles this round belongs to (SPEC-020). */
  readonly track: Track;
  /** UTC date key for a daily round; null for practice (never persisted). */
  readonly dateKey: string | null;
  readonly answerId: string;
  readonly guesses: readonly Guess[];
  readonly hintUsed: boolean;
  readonly outcome: RoundOutcome;
}

export function startRound(
  mode: RoundMode,
  answerId: string,
  dateKey: string | null,
  track: Track = "full",
): Round {
  return {
    mode,
    track,
    dateKey,
    answerId,
    guesses: [],
    hintUsed: false,
    outcome: "playing",
  };
}

/** Append an evaluated guess and settle the outcome (REQ-007). */
export function applyGuess(round: Round, guess: Guess): Round {
  if (round.outcome !== "playing") return round;
  const guesses = [...round.guesses, guess];
  const outcome: RoundOutcome = guess.correct
    ? "won"
    : guesses.length >= MAX_GUESSES
      ? "lost"
      : "playing";
  return { ...round, guesses, outcome };
}

/** The hint is offered only after `HINT_AFTER_GUESSES` misses (REQ-008). */
export function hintAvailable(round: Round): boolean {
  return (
    round.outcome === "playing" &&
    !round.hintUsed &&
    round.guesses.length >= HINT_AFTER_GUESSES
  );
}

/** Taking the hint consumes no guess and never ends the round (REQ-008). */
export function takeHint(round: Round): Round {
  return hintAvailable(round) ? { ...round, hintUsed: true } : round;
}

/** A node on the established trunk, root-first. */
export interface TrunkNode {
  readonly id: string;
  readonly name: string;
  readonly rank: string;
  /** True for the deepest established node — the frontier. */
  readonly frontier: boolean;
  /** The guess that first reached this depth, when one did. */
  readonly reachedBy: string | null;
  /** Branches eliminated at this node, in the order they were ruled out. */
  readonly ruledOut: readonly {
    readonly id: string;
    readonly name: string;
    readonly by: string;
  }[];
}

export interface RevealedTree {
  readonly trunk: readonly TrunkNode[];
  /** True while the descent below the frontier is still unknown. */
  readonly unresolved: boolean;
}

/**
 * The tree the player has established (REQ-005). Renders **only nodes a guess
 * has touched**: the trunk from `Dinosauria` down to the deepest shared clade
 * reached, plus the branch each guess eliminated. It never enumerates a node's
 * other children — `Dinosauria` has 26 of them in the snapshot, mostly ichnotaxa
 * and ootaxa, so listing them would read as database noise *and* hand the player
 * the answer by elimination.
 *
 * A later, shallower guess never retracts a confirmed node, and two guesses in
 * the same branch produce one elimination, not two.
 */
export function revealedTree(round: Round, data: GameData): RevealedTree {
  const rootId = data.index.rootId;
  if (!rootId) return { trunk: [], unresolved: true };

  // Deepest shared clade reached so far — the frontier. Monotonic by
  // construction: we take the maximum over all guesses, so order cannot retract.
  let frontierId = rootId;
  let frontierDepth = -1;
  for (const g of round.guesses) {
    if (g.sharedDepth > frontierDepth) {
      frontierDepth = g.sharedDepth;
      frontierId = g.sharedId;
    }
  }
  const won = round.outcome === "won";
  // On a win the answer itself is established, so the trunk runs all the way to
  // it rather than stopping at the last shared clade.
  const deepest = won ? round.answerId : frontierId;
  const chain = data.index.ancestors(deepest);

  const reachedBy = new Map<string, string>();
  const eliminations = new Map<
    string,
    { id: string; name: string; by: string }[]
  >();
  const seenBranch = new Set<string>();
  for (const g of round.guesses) {
    if (!reachedBy.has(g.sharedId)) reachedBy.set(g.sharedId, g.scientificName);
    if (!g.ruledOutId || !g.ruledOutName || g.correct) continue;
    if (seenBranch.has(g.ruledOutId)) continue;
    seenBranch.add(g.ruledOutId);
    const list = eliminations.get(g.sharedId) ?? [];
    list.push({ id: g.ruledOutId, name: g.ruledOutName, by: g.scientificName });
    eliminations.set(g.sharedId, list);
  }

  const trunk: TrunkNode[] = chain.map((t, i) => ({
    id: t.id,
    name: t.scientificName,
    rank: t.rank,
    frontier: i === chain.length - 1 && chain.length > 1,
    reachedBy: reachedBy.get(t.id) ?? null,
    ruledOut: eliminations.get(t.id) ?? [],
  }));

  return { trunk, unresolved: !won };
}
