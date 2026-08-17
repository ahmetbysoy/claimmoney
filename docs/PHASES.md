# Roadmap Completion

## Phase 0 — Behavior capture and replay

- [x] Injectable system/manual clock
- [x] MarketEvent schema validation
- [x] JSONL recorder/parser/replay
- [x] Runtime byte-equivalence replay integration test
- [x] Recording export, JSONL replay controls and replay report download
- [x] Typecheck, test, build and audit scripts
- [x] GitHub Actions CI

## Phase 1 — Correctness

- [x] Snapshot/delta distinction and sequence-gap resync state
- [x] OKX signed CRC32 checksum verification with forced resync
- [x] WebSocket heartbeat and idle watchdog with reconnect backoff
- [x] Filter-before-FSM ordering
- [x] Same-side confirmation, dwell and max-gap
- [x] Flow rollover and oversized volume split
- [x] Bid/ask spoof side and iceberg direction
- [x] Actionable cross-exchange spread
- [x] Quantity-correct paper R
- [x] Post-Kelly dependent field recalculation
- [x] Horizon-specific eligible samples
- [x] Detector score in UI metrics

## Phase 2 — Runtime and FeatureFrame

- [x] Instance-owned `MarketRuntime`
- [x] Fixed 100 ms FeatureFrame cadence
- [x] Typed clock/event/telemetry primitives
- [x] DataQualityGate and warmup validity
- [x] Zustand reduced to read model
- [x] No module-load network/timer side effects

## Phase 3 — Detectors and risk

- [x] Deduplicating/decaying detector registry with per-type cap
- [x] Bid and ask ladder support
- [x] Approved-signal-only planner
- [x] Instrument tick/lot rounding and net RR
- [x] Conservative versioned position sizing
- [x] Pending paper orders, partial fills model, TP1 partial exit, fees/slippage

## Phase 4 — Measurement and calibration

- [x] Bounded horizon tracker and unbiased samples
- [x] Bayesian-shrunk score calibration bins
- [x] Versioned session persistence, JSON import and export
- [x] Purged walk-forward folds and performance metrics
- [x] Strategy version attached to signals/outcomes

## Phase 5 — Product

- [x] Lazy-loaded screens and vendor chunks
- [x] Microstructure/data-quality diagnostics
- [x] Detector timeline and cross-exchange panel
- [x] Paper plan/risk/performance dashboard
- [x] Real trade-volume delta chart
- [x] Independent sound/haptics and reduced motion
- [x] Source-specific futures instrument catalog
- [x] Error boundary, bounded client-error reporting and Vercel Analytics
- [x] Desktop/mobile Playwright smoke and live production QA suites
- [x] Health endpoint and production operations runbook

## Deliberate non-goals

- Real-money order execution
- API-key custody
- Claims of profitability
- Self-modifying live strategy weights

Those require separate security, compliance, exchange certification and statistically valid out-of-sample research.
