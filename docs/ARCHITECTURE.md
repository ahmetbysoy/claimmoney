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

React creates one runtime per source/symbol session. It also owns `WsManager`. Adapter output is converted to `MarketEvent`, validated, and sent to runtime. Runtime snapshots are copied into a Zustand read model. On symbol/source change the old manager and runtime are disposed and a fresh isolated session is created.

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

`ResearchScreen` excludes injected test signals and computes horizon-specific grouped metrics, calibration gaps and purged walk-forward folds. Dataset JSON import/export provides browser-storage backup; no market recording or balance is uploaded.

## No automatic live learning

Forward outcomes feed versioned calibration observations. They do not rewrite strategy weights during the same session. Research reports remain descriptive and use purged walk-forward folds from `src/performance/walkForward.ts`; they never mutate live strategy settings.
