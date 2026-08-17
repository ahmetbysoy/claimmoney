# ClaimMoney

Deterministic, event-time based crypto futures microstructure research and paper-execution platform.

> **Research/education only. It is not investment advice and does not place real orders.**

## What changed in v2

ClaimMoney is a clean repository derived from the Tierflow prototype and implements the full hardening roadmap:

- normalized `MarketEvent` contracts with snapshot/delta and sequence metadata;
- injectable clock, JSONL recorder/replay and deterministic feature frames;
- synchronized local order book with snapshot replacement, delta gap detection, OKX CRC32 verification and immutable snapshots;
- WebSocket heartbeat/idle watchdog with bounded jittered reconnect;
- 100 ms `FeatureFrame` cadence instead of trade/mark double-counting;
- CVD, OBI, velocity, microprice, VPIN, volatility, divergence and detector validity/warmup;
- typed data-quality, filter, score and FSM pipeline;
- same-direction/dwell confirmations; filters run **before** FSM state changes;
- nine microstructure detectors behind a deduplicating, decaying detector registry;
- approved-signal-only planner, tick rounding, net RR and conservative position sizing;
- pending paper orders, slippage, fees, partial TP1, breakeven stop and correct dollar-R accounting;
- unbiased horizon statistics, calibration bins, session import/export and purged walk-forward utilities;
- browser recording export plus isolated deterministic JSONL replay reports;
- Radar, Chart, Signals, Microstructure diagnostics, Paper and Settings screens;
- source-specific instrument catalogs, independent sound/haptics and reduced-motion support;
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

The core runtime is `src/application/marketRuntime.ts`. React owns its lifecycle; importing a store no longer starts timers, WebSockets or polling.

## Run

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm audit
```

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
- `src/core/performance/`, `src/performance/`: horizon metrics, calibration, persistence and walk-forward
- `src/testing/replay/`: JSONL deterministic recorder/replay
- `src/ui/`: lazy-loaded product and diagnostics screens

## Safety model

- No exchange API keys.
- No real-order endpoint or execution adapter.
- Paper mode defaults to off.
- Data marked stale, unsynchronized or warming cannot advance the signal FSM.
- “Confidence” remains an uncalibrated score display until enough version-matched outcomes exist; then the calibrator can provide a shrunken empirical probability.
- Strategy feedback is stored/versioned and is not used to mutate live weights inside the same session.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/PHASES.md`](docs/PHASES.md).
