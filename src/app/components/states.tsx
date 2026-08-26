/**
 * Required data states (SPEC-003 REQ-008; charter §7). Loading, empty, and error
 * surfaces — designed, not left to the happy path (FONC-1260/1280/1310/1330,
 * PERF-050). The error state's primary action is Retry (teal); filters are
 * preserved by the caller (FONC-1340).
 */

import type { ReactElement } from "react";
import type { LoadProgress } from "../data/snapshot.js";
import styles from "./exploration.module.css";

function formatMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * Loading surface (SPEC-003 REQ-008; SPEC-006 UX-002/003). Shows a determinate
 * progress bar when the download reports a byte ratio, and a labelled
 * indeterminate bar otherwise. The bar is a `role="progressbar"` so assistive
 * tech announces progress; the phase/percentage is also plain text (never
 * colour-only — PERF-250). Reduced motion is honoured in CSS.
 */
export function LoadingState({
  label,
  progress,
}: {
  label?: string;
  progress?: LoadProgress | null;
}): ReactElement {
  const phase = progress?.phase;
  const ratio = progress?.ratio;
  const determinate = typeof ratio === "number";
  const percent = determinate ? Math.round(ratio * 100) : undefined;

  const phaseLabel =
    label ??
    (phase === "preparing"
      ? "Preparing the view…"
      : phase === "ready"
        ? "Ready"
        : "Downloading fossil data…");

  const detail =
    determinate && percent !== undefined
      ? `${percent}%`
      : progress?.receivedBytes
        ? formatMb(progress.receivedBytes)
        : null;

  return (
    <div className={styles.stateWrap} role="status" aria-live="polite">
      <p className={styles.stateTitle}>{phaseLabel}</p>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        {...(determinate ? { "aria-valuenow": percent } : {})}
        aria-label={phaseLabel}
      >
        <div
          className={`${styles.progressBar} ${determinate ? "" : styles.progressIndeterminate}`}
          style={determinate ? { width: `${percent}%` } : undefined}
        />
      </div>
      {detail && <p className={styles.progressDetail}>{detail}</p>}
    </div>
  );
}

export function EmptyState({ onReset }: { onReset: () => void }): ReactElement {
  return (
    <div className={styles.stateWrap} role="status">
      <p className={styles.stateTitle}>No occurrences at this age</p>
      <p>No fossil occurrence overlaps the selected stage.</p>
      <button type="button" className={styles.primary} onClick={onReset}>
        Reset view
      </button>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  /**
   * Omitted where there is nothing to retry — the Dinordle data-error surfaces
   * are a bad snapshot, not a failed fetch, and since SPEC-022 the app bar is
   * always present as the way out, so a button that only navigated away would
   * duplicate a destination (REQ-004).
   */
  onRetry?: (() => void) | undefined;
}): ReactElement {
  return (
    <div className={styles.stateWrap} role="alert">
      <p className={`${styles.stateTitle} ${styles.errorTitle}`}>
        Could not load the snapshot
      </p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className={styles.primary} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
