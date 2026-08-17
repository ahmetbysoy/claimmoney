# ClaimMoney Architecture

## Invariants

1. Every market message has exchange, canonical symbol, event time and receive time.
2. Book snapshots replace state; deltas require contiguous sequence coverage.
3. Replay and live processing use the same `MarketRuntime` and injected clock.
4. Raw event handlers only update domain engines; decisions occur on fixed feature frames.
5. Missing/warming data is invalid, never silently converted into a valid zero.
6. Hard filters execute before the FSM and cannot consume confirmations/cooldown.
7. Confirmations must have the same side and satisfy maximum gap/minimum dwell.
8. Only an approved final signal can create a plan or paper order.
9. Risk is measured in quote-currency dollars including quantity and costs.
10. Runtime services are disposable; imports do not start network/timer side effects.

## Runtime lifecycle

React creates one runtime per source/symbol session and owns `WsManager`. Adapters emit canonical `MarketEvent` values directly; the runtime validates them before ingestion. `runtimeCollaborators.ts` is the default composition root, while tests may inject an explicit collaborator set. Approved-signal planning, sizing and at-most-once paper submission are delegated to `SignalExecutionCoordinator`. The runtime owns collaborator subscriptions and releases them on disposal.

Feature evaluation remains event-time deterministic at 100 ms. Broad UI read-model publication is separately capped at 250 ms, with signal snapshots reused until the immutable signal list changes. On symbol/source change the old manager and runtime are disposed and a fresh isolated session is created.

## Determinism

`Clock` is injected into order book, VPIN, flow, paper execution, cross exchange, detector registry and runtime. `ManualClock` plus `MarketReplay` sorts a JSONL fixture by event/receive time and sends it through the same ingest APIs.

## Decision order

```text
Feature frame
→ validity mask and quality
→ detector/type contribution cap
→ weighted directional score
→ toxicity conviction multiplier
→ filter decisions
→ soft score adjustment
→ qualified FSM tick
→ approved signal
```

## Research persistence

Approved signals carry immutable research context: regime, quality, active detector types, volatility, VPIN and spread. Their horizon trackers are upserted into `LocalResearchRepository` every minute and on page lifecycle transitions. The composite session/signal ID prevents checkpoint duplication, retention is capped at 5,000 observations, and quota pressure drops the oldest records first.

`ResearchScreen` excludes injected test signals and computes horizon-specific grouped metrics, score/outcome bins and purged walk-forward folds. A calibration gap is shown only for observations that carried an actual empirically calibrated probability; heuristic score strength is never treated as a probability. Dataset JSON import/export provides browser-storage backup; no market recording or balance is uploaded.

## No automatic live learning

Forward outcomes feed versioned calibration observations. Calibration estimates an outcome probability inside score bins after the minimum sample count; it does not learn or rewrite strategy weights. Research reports remain descriptive and use purged walk-forward folds from `src/performance/walkForward.ts`; they never mutate live strategy settings.

## Exchange and execution semantics

- Binance partial depth is normalized as a complete top-N snapshot on every message.
- OKX `books` snapshots replace state; `update` messages remain deltas with `prevSeqId` continuity. A gap asks `WsManager` for a fresh connection/snapshot.
- OKX `trades.px` and `mark-price.markPx` remain distinct event types. Mark is retained as non-executable context and cannot advance trade candles, forward returns or paper fills. Ticker `last` is not used as a mark price.
- The local book retains bounded internal depth beyond the visible top levels so a top-level deletion can reveal a previously stored level.
- Paper entries walk only the executable side of the sampled book, reject insufficient sampled liquidity and enforce a maximum adverse-slippage bound.
- `returnQuality` is unannualized mean closed-trade R divided by its standard deviation. `liqPriceEstimate` is only a simplified isolated-margin screening estimate, not an exchange liquidation quote.
