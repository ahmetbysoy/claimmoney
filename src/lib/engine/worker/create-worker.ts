'use client';

/**
 * BOZOK PRO v4.0 — Inline Web Worker Creator
 *
 * Creates a Web Worker from the bozok-worker.ts source via Blob URL.
 * This avoids Next.js bundling issues with Web Workers.
 */

import type { WorkerInMessage, WorkerOutMessage } from './worker-types';

export interface BozokWorkerHandle {
  worker: Worker;
  send: (msg: WorkerInMessage) => void;
  terminate: () => void;
}

export type WorkerMessageHandler = (msg: WorkerOutMessage) => void;

// Cache the Blob URL so we only create it once per page load
let cachedBlobUrl: string | null = null;

/**
 * Creates the worker code string by importing the source.
 * In production, this would be pre-bundled. For dev, we fetch the raw source.
 */
async function getWorkerSource(): Promise<string> {
  // The worker source is self-contained with no imports.
  // We inline it as a string to avoid bundling issues.
  // For dynamic import, we read the worker file at build time.
  // Here we use a module-level import trick:
  // Since the worker has `export {}` at the end, we strip it.
  try {
    const mod = await import('./bozok-worker.ts?raw');
    let src = (mod as unknown as { default: string }).default;
    if (typeof src !== 'string') {
      // Next.js may return the module object itself
      src = String(mod);
    }
    // Strip `export {}` and any import statements (worker must be self-contained)
    src = src.replace(/^\s*export\s+\{\s*\}\s*;?\s*$/m, '');
    src = src.replace(/^\s*import\s+.*$/gm, '');
    return src;
  } catch {
    // Fallback: fetch the raw file
    try {
      const resp = await fetch('/src/lib/engine/worker/bozok-worker.ts');
      if (resp.ok) {
        let src = await resp.text();
        src = src.replace(/^\s*export\s+\{\s*\}\s*;?\s*$/m, '');
        src = src.replace(/^\s*import\s+.*$/gm, '');
        return src;
      }
    } catch {
      // ignore
    }
    throw new Error('Failed to load bozok-worker source');
  }
}

/**
 * Creates a Bozok Web Worker from an inline Blob URL.
 *
 * @param onMessage - Callback for worker messages (state snapshots, errors, etc.)
 * @returns A handle with send/terminate methods
 */
export async function createBozokWorker(
  onMessage: WorkerMessageHandler,
): Promise<BozokWorkerHandle> {
  let blobUrl = cachedBlobUrl;

  if (!blobUrl) {
    const source = await getWorkerSource();
    const blob = new Blob([source], { type: 'application/javascript' });
    blobUrl = URL.createObjectURL(blob);
    cachedBlobUrl = blobUrl;
  }

  const worker = new Worker(blobUrl);

  worker.onmessage = (e: MessageEvent) => {
    onMessage(e.data as WorkerOutMessage);
  };

  worker.onerror = (err) => {
    console.error('[BozokWorker] Error:', err);
    onMessage({ type: 'error', msg: err.message || 'Worker error' });
  };

  return {
    worker,
    send: (msg: WorkerInMessage) => {
      worker.postMessage(msg);
    },
    terminate: () => {
      worker.terminate();
    },
  };
}
