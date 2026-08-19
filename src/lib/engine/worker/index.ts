/**
 * BOZOK PRO v4.0 — Worker Module
 * Barrel export for the inline Web Worker.
 */

export type { WorkerInMessage, WorkerOutMessage, StateSnapshot, WorkerConfig } from './worker-types';
export { DEFAULT_WORKER_CONFIG } from './worker-types';
export type { PlanState, PlanDirection, RegimeType, SignalType } from './worker-types';
export type { StateDiff, SignalRecord, WallTrack, IcebergTrack, VoidTrack, Plan, KellyResult, RiskGateResult } from './worker-types';

// The worker source is imported as-is for inline Blob Worker usage
export { default } from './bozok-worker';
