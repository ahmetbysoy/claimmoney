# Changelog

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
