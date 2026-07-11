/**
 * App shell (SPEC-003 REQ-008, NFR-001). Owns the snapshot-load lifecycle:
 * loading → ready → error, with a Retry that re-runs the injected loader
 * (FONC-1260/1310/1330). The loader is a prop so the production entry point
 * injects the static-artifact fetch (`data/snapshot.json`) while tests inject a
 * model directly — no network, no runtime backend.
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { ReadApi } from '../read/api.js';
import type { ModelLoader } from './data/snapshot.js';
import { readApiFromModel } from './data/snapshot.js';
import { ExplorationView } from './components/ExplorationView.js';
import { ErrorState, LoadingState } from './components/states.js';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; api: ReadApi }
  | { kind: 'error'; message: string };

export function App({ loader }: { loader: ModelLoader }): ReactElement {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: 'loading' });
    loader()
      .then((model) => {
        if (!cancelled) setStatus({ kind: 'ready', api: readApiFromModel(model) });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loader, attempt]);

  if (status.kind === 'loading') {
    return <LoadingState label="Loading the dated snapshot…" />;
  }
  if (status.kind === 'error') {
    return <ErrorState message={status.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  return <ExplorationView api={status.api} />;
}
