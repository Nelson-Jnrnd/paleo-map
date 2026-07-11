/**
 * Required data states (SPEC-003 REQ-008; charter §7). Loading, empty, and error
 * surfaces — designed, not left to the happy path (FONC-1260/1280/1310/1330,
 * PERF-050). The error state's primary action is Retry (teal); filters are
 * preserved by the caller (FONC-1340).
 */

import type { ReactElement } from 'react';
import styles from './exploration.module.css';

export function LoadingState({ label }: { label: string }): ReactElement {
  return (
    <div className={styles.stateWrap} role="status" aria-live="polite">
      <p className={styles.stateTitle}>{label}</p>
    </div>
  );
}

export function EmptyState({ onReset }: { onReset: () => void }): ReactElement {
  return (
    <div className={styles.stateWrap} role="status">
      <p className={styles.stateTitle}>No occurrences at this age</p>
      <p>No fossil occurrence overlaps the selected stage with the active filters.</p>
      <button type="button" className={styles.primary} onClick={onReset}>
        Reset filters
      </button>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): ReactElement {
  return (
    <div className={styles.stateWrap} role="alert">
      <p className={`${styles.stateTitle} ${styles.errorTitle}`}>Could not load the snapshot</p>
      <p>{message}</p>
      <button type="button" className={styles.primary} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
