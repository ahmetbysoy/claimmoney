# Changelog

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
