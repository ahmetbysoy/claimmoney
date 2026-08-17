# ClaimMoney

Deterministic, event-time based crypto futures microstructure research and paper-execution platform.

**Live:** [claimmoney-drab.vercel.app](https://claimmoney-drab.vercel.app)

> **Research/education only. It is not investment advice and does not place real orders.**

## Current platform (v2.1 + unreleased hardening)

ClaimMoney is a clean repository derived from the Tierflow prototype and implements the hardening and research-measurement roadmap:

- normalized `MarketEvent` contracts with snapshot/delta and sequence metadata;
- injectable clock, JSONL recorder/replay and deterministic feature frames;
- truthful stream semantics: Binance top-N snapshots, OKX snapshot/delta continuity, distinct OKX trade/mark prices, CRC32 verification and reconnect-on-gap;
- WebSocket heartbeat/idle watchdog with bounded jittered reconnect;
- 100 ms `FeatureFrame` cadence instead of trade/mark double-counting;
- CVD, OBI, velocity, microprice, VPIN, volatility, divergence and detector validity/warmup;
- typed data-quality, filter, score and FSM pipeline;
- same-direction/dwell confirmations; filters run **before** FSM state changes;
- nine microstructure detectors behind a deduplicating, decaying detector registry;
- approved-signal-only planner, tick rounding, net RR and conservative position sizing;
- pending paper orders, side-specific depth walking, bounded slippage, liquidity rejection, fees, partial TP1, breakeven stop and dollar-R accounting;
- horizon statistics, score/outcome bins, probability-only calibration gaps, session import/export and purged walk-forward utilities;
- browser recording export plus isolated deterministic JSONL replay reports;
- minute checkpoints into a bounded, deduplicating local research dataset;
- regime, detector, symbol, calibration and purged walk-forward research dashboard;
- versioned research dataset backup/import with test-signal exclusion and readiness gates;
- Radar, Chart, Signals, Microstructure diagnostics, Paper, Research Lab and Settings screens;
- source-specific instrument catalogs, independent sound/haptics and reduced-motion support;
- React error boundary, sanitized client-error reporting, Vercel Analytics and health endpoint;
- desktop/mobile Playwright smoke and opt-in live production acceptance tests;
- TypeScript strict check, 0-audit dependency tree, expanded regression suite and GitHub Actions CI.

## Architecture

```text
Exchange adapters
  → MarketEvent validation / sequencing
  → Trade window + OrderBook + canonical price
  → FeatureFrameBuilder (fixed 10 Hz)
  → DataQualityGate + DetectorRegistry + RegimeClassifier
  → ScoreAggregator
  → hard/soft filters
  → same-direction SignalEngine FSM
  → Approved Signal Bus
      ├─ Forward tracker / probability calibration
      ├─ Trade planner / position sizer
      ├─ Paper broker
      └─ Zustand read model / UI
```

The orchestration boundary is `src/application/marketRuntime.ts`; `src/application/runtimeCollaborators.ts` is its explicit default composition root. React owns the lifecycle, and importing a store does not start timers, WebSockets or polling.

## Run

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm audit
npm run test:e2e
npm run test:e2e:production
```

## Research collection

Open the **Lab** tab while live market data is connected. ClaimMoney checkpoints the active session and upserts mature signal outcomes every minute, plus on visibility changes and page exit. The bounded local dataset retains up to 5,000 observations and can be backed up/restored as JSON.

The dashboard excludes user-injected test signals, supports 15s–15m horizons, and reports regime/detector/symbol groups, score/outcome bins and purged walk-forward folds. Calibration gaps appear only where an actual calibrated probability was available. `review-ready` requires at least 200 mature observations spanning seven days; it is a data-sufficiency gate, not evidence of profitability.

## Main modules

- `src/domain/`: market contracts, validation and instrument precision
- `src/application/`: runtime, clock, typed event bus, data quality and telemetry
- `src/features/`: deterministic feature and candle builders
- `src/core/book/`: snapshot/delta local book
- `src/core/indicators/`: CVD/OBI/velocity/VPIN
- `src/core/detectors/`: detector suite and contribution registry
- `src/core/signal/`: score, filters, regime and FSM decision pipeline
- `src/risk/`: approved-signal planner and position sizing
- `src/core/paper/`: pending-order and paper execution engine
- `src/core/performance/`, `src/performance/`: horizon metrics, bounded research persistence, calibration, grouped reporting and walk-forward
- `src/testing/replay/`: JSONL deterministic recorder/replay
- `src/ui/`: lazy-loaded product and diagnostics screens

## Safety model

- No exchange API keys.
- No real-order endpoint or execution adapter.
- Paper mode defaults to off.
- Data marked stale, unsynchronized or warming cannot advance the signal FSM.
- Before calibration, the UI labels the display as **score strength**, not confidence/probability. A shrunken empirical probability is shown only after enough version-matched outcomes exist.
- `liqPriceEstimate` is a simplified risk-screening estimate, not an exchange-accurate liquidation price; paper `returnQuality` is not annualized Sharpe.
- Strategy feedback is stored/versioned and is not used to mutate live weights inside the same session.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/REVIEW_TRIAGE.md`](docs/REVIEW_TRIAGE.md), [`docs/PHASES.md`](docs/PHASES.md) and the [`docs/PRODUCTION.md`](docs/PRODUCTION.md) runbook.
