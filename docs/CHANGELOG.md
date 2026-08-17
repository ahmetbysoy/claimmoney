# Changelog

## Unreleased

- Kept OKX trade and mark-price semantics distinct through runtime use (mark is non-executable context); native book updates now reach the canonical delta path with `prevSeqId` gap resynchronization.
- Documented Binance partial depth as top-N snapshots and added bounded adapter diagnostics instead of silent parse failures.
- Retained bounded full book maps beyond visible depth so hidden levels survive top-level deletions.
- Added Binance liquidation-stream normalization and wired liquidation events into runtime detector inputs.
- Added an injectable runtime composition root, extracted approved-signal execution coordination, owned subscription disposal, 250 ms read-model publication and cached immutable signal snapshots.
- Replaced scalar paper depth with side-specific volume-weighted book walking, insufficient-liquidity rejection and bounded slippage.
- Renamed the non-annualized paper metric to `returnQuality` and the simplified margin screen to `liqPriceEstimate`.
- Made uncalibrated output explicitly score strength; research calibration gaps now use only observations carrying an actual calibrated probability.
- Added default neutral dwell, immediate persisted cooldown ownership after a fired transition, configurable wall relevance and performance-risk priors.
- Added exchange adapter, book retention/resync, FSM lifecycle, paper depth/slippage, feature-window and runtime collaborator regression coverage.

## 2.1.0 — 2026-08-17

- Added minute/page-lifecycle checkpoints into a bounded 5,000-observation local research repository.
- Enriched approved signals with regime, quality, detector, volatility, VPIN and spread research context.
- Added a Research Lab for horizon-specific regime, detector and symbol metrics, calibration gaps and purged walk-forward results.
- Added dataset backup/import, test-signal exclusion and explicit 200-sample/seven-day readiness gates.
- Added quota-aware active-session checkpoint replacement and expanded unit/browser coverage.

## 2.0.1 — 2026-08-17

- Added a React error boundary, global error/rejection capture and sanitized Vercel log ingestion.
- Added Vercel Analytics and a no-cache production health endpoint.
- Added desktop/mobile Playwright smoke tests and opt-in live exchange production checks.
- Added browser-test CI and the production operations runbook.
- Corrected OKX's current `checksum: 0` no-checksum sentinel handling while retaining CRC32 validation for non-zero checksums.

## 2.0.0 — 2026-08-17

- New ClaimMoney repository and deterministic MarketRuntime.
- Completed correctness, orchestration, detector/risk, measurement and product phases.
- Expanded regression suite from 25 to 62 tests, including runtime replay equivalence and app smoke coverage.
- Added JSONL recording/replay controls, session import/export, OKX checksum validation and a WebSocket watchdog.
- Added strict typecheck, secure dependency upgrades, CI and zero audit findings.
