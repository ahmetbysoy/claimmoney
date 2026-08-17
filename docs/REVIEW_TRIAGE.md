# Adversarial Review Triage

This document records how the August 2026 technical review was classified. It is intentionally not a blanket acceptance of every assertion.

## Verified correctness defects — remediated

| Area | Finding | Remediation |
|---|---|---|
| OKX price semantics | Ticker `last` was presented as mark price. | Removed the ticker substitution. `trades.px` emits executable `trade`; `mark-price.markPx` is retained as non-executable context and cannot drive paper fills, candles or forward returns. |
| OKX book semantics | Native updates were merged and emitted as snapshots. | Native `snapshot` replaces state; native `update` emits a canonical delta with `prevSeqId`, `seqId` and reconnect-on-gap behavior. |
| Adapter failures | Malformed messages could disappear through empty catches. | Added typed, rate-limited diagnostics with cumulative dropped-message counts; socket, subscription and checksum failures are observable. |
| Book retention | Visible top-N arrays were used to rebuild the internal maps, discarding hidden levels. | Visible arrays are now projections of bounded full-depth maps. Deleting a top level reveals retained depth. |
| Liquidations | Detector inputs supported liquidations but the runtime never supplied them. | Added Binance forced-liquidation normalization and runtime liquidation retention/mapping into detector inputs. |
| FSM lifecycle | `FIRED` was redundantly assigned and persisted ambiguously. | `FIRED` is now the transition result; internal state owns `COOLDOWN` immediately. The test-only internal-state accessor was removed. |
| Hysteresis | Neutral dwell defaulted to zero. | Default neutral dwell is 250 ms and is behaviorally tested. |
| Uncalibrated display | A threshold-specific magic denominator was presented as confidence. | Fallback output is score strength over the documented ±3 score range. Probability language is used only when empirical calibration is available. |
| Paper execution | One scalar summed both book sides and produced synthetic fills. | Entry simulation walks only asks for longs or bids for shorts, uses volume-weighted price, rejects insufficient sampled liquidity and enforces a slippage bound. |
| Contract accounting | Paper PnL/risk did not carry the instrument contract multiplier. | Orders and positions retain the multiplier; entry/exit fees, PnL and initial dollar risk use it. |
| Performance naming | A sample-count-scaled trade-return statistic was called Sharpe. | Replaced it with unannualized `returnQuality = mean(R) / std(R)` and changed UI/docs. |
| Liquidation naming | A simplified formula looked exchange-accurate. | Renamed it `liqPriceEstimate` and documented it as a screening estimate only. |
| Research calibration | Heuristic score strength was compared as if it were a predicted probability. | Calibration gaps now use only observations that carried an actual calibrated probability. Score/outcome bins remain descriptive. |
| Feature hot path | The 60-second CVD window rescanned the full trade ring, and recent-trade callers copied all 5,000 entries. | Added incremental rolling flow with deterministic out-of-order rebuild, efficient `lastN`, and less frequent array pruning. |
| Runtime composition | `MarketRuntime` directly constructed nearly every subsystem. | Added an injectable composition root and extracted `SignalExecutionCoordinator` for planning, sizing and at-most-once paper submission. Runtime owns and disposes subscriptions. |
| Emitters/types | Several bespoke untyped emitters and production `any` casts remained. | Adopted `TypedEventBus` in book, detectors, VPIN, tracker, paper and cross-exchange paths; adapter parsing now starts from `unknown`. |
| Planner constants | Wall relevance and several distance constants were embedded in methods. | Added explicit planner configuration for wall distance, entry buffer, volatility/spread distance and tick distance. Position-risk prior/scaling constants are configurable and labeled heuristic. |

## Valid architectural debt — reduced, not declared eliminated

- `MarketRuntime` remains the session orchestrator. Construction moved to `runtimeCollaborators.ts`, execution coordination was extracted, and ownership is explicit; persistence/export and read-model assembly can be separated in later measured changes.
- Runtime UI snapshots are still broad. Publication is now capped at 250 ms and immutable signal snapshots are cached. Further section-level revision caches should be driven by profiling rather than assumed render behavior.
- Robust z-score clipping and divergence extrema still perform bounded small-window work. The largest repeated trade scans were removed; further data-structure changes need benchmark evidence and replay-equivalence checks.
- Detector thresholds are not all user-configurable. The detector suite already has a config boundary, but changing every threshold at once would alter strategy behavior without evidence.
- Paper execution is deliberately conservative and deterministic, not an exchange matching-engine simulator. It does not claim queue position, hidden liquidity or exchange-accurate liquidation.

## Assertions rejected or narrowed

- **“Every Zustand selector rerenders whenever top-level state changes.”** False for primitive/reference-stable selectors. Zustand compares each selector result. Broad cloned object sections can rerender, which is why publication/caching was improved, but the universal claim is incorrect.
- **“Binance partial depth must be treated as deltas.”** False. Binance partial-depth streams are complete top-N snapshots; typing them as snapshots is truthful.
- **“One scalar price can hit a position's stop and TP2 simultaneously.”** Not for a directionally valid plan with ordered stop/entry/targets. Gap handling and target ordering still received conservative tests and logic.
- **“Closed quantity is wholly lost.”** Overstated. `initialQty` was already retained while live `qty` becomes zero on close. Contract multiplier retention and accounting were the actual missing pieces.
- **“Probability calibration automatically learns strategy weights.”** False. Calibration estimates empirical outcome probability in score bins; it never mutates strategy weights.

## Regression evidence

Coverage now includes truthful adapter event semantics, bounded diagnostics, snapshot/delta continuity, hidden-depth retention, explicit resynchronization, liquidation wiring, FSM transition ownership and neutral dwell, side-specific depth walking, insufficient liquidity, contract-multiplier PnL, metric naming/formula, incremental feature windows, injected runtime collaborators, lifecycle disposal and deterministic replay equivalence.

No profitability or statistical-significance conclusion follows from these engineering changes. Research readiness still requires mature real observations over the configured sample/time gate.
