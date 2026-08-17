# Production Operations

## Endpoints

- Application: <https://claimmoney-drab.vercel.app>
- Health: <https://claimmoney-drab.vercel.app/api/health>
- Cross-exchange quote proxy: `/api/cross-exchange`
- Bounded client error collector: `/api/client-errors`

## Automated checks

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:e2e:production
```

The regular browser suite runs desktop and mobile smoke checks against a local Vite server. The production suite additionally validates the health endpoint, quote proxy, OKX live WebSocket stream, live prices and Binance source switching. Production checks only run when `PRODUCTION_QA=1` is set so CI does not become dependent on exchange availability.

## Observability

- `@vercel/analytics` records privacy-oriented aggregate page analytics.
- `ErrorBoundary` prevents a render failure from leaving a blank screen.
- Global `error` and `unhandledrejection` handlers send bounded, deduplicated reports.
- Unexpected WebSocket disconnects are reported with source and symbol context.
- `/api/client-errors` rejects cross-site submissions, caps payloads at 16 KiB and emits sanitized structured events to Vercel logs.
- Error messages and stacks have URL query strings removed. Session payloads, balances, recordings and localStorage values are never included.

Search Vercel runtime logs for `claimmoney.client_error` or a report fingerprint. A third-party error backend can be added later if durable alerting and issue grouping are required.

## Acceptance checklist

Verified on 2026-08-17 with the v2.0.1 desktop/mobile Playwright suites:

- [x] Home and `/api/health` return HTTP 200.
- [x] OKX reaches `connected` and emits a positive price.
- [x] Binance source switching reconnects successfully.
- [x] Radar, Chart, Signals, Microstructure, Paper and Settings chunks render.
- [x] Symbol normalization remounts an isolated runtime.
- [x] Test signal reaches the planner; a risk-rejected plan may correctly remain `NEUTRAL`.
- [x] Paper mode has no exchange-order API or execution adapter.
- [x] Session JSON and market JSONL export work.
- [x] Session JSON import and isolated JSONL replay/report download work.
- [x] Mobile and desktop layouts have no horizontal overflow.

## Seven-day research collection

1. Keep the production app open and visible with a live exchange connection.
2. Use naturally approved signals for measurement; injected test signals are retained for diagnostics but excluded from reports.
3. ClaimMoney checkpoints every 60 seconds and during visibility/page lifecycle transitions.
4. Open **Lab** to inspect 15s, 30s, 60s, 5m and 15m maturity coverage.
5. Export the research dataset daily and retain backups outside browser storage.
6. Do not interpret results before the dashboard reaches at least 200 mature observations over seven days.
7. Review expectancy, median, drawdown, calibration gaps and purged walk-forward folds together; never select a detector using win rate alone.

Storage is origin-local and bounded to 5,000 observations. Clearing browser data removes the active dataset unless a JSON backup is restored.

## OKX checksum behavior

A non-zero OKX checksum is verified using the signed CRC32 top-25 bid/ask algorithm. OKX may return `checksum: 0` on `books`; zero is the exchange's current no-checksum sentinel and must not trigger a reconnect. Sequence/checksum failures with actual values force resynchronization.

## Rollback

Use the Vercel deployment history to promote the last known-good production deployment. Git rollback should be performed with a new revert commit on `main`; do not rewrite public history.
