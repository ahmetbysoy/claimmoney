# Obsidian / Ion terminal UI

## Scope

The interface is a responsive, data-first market-research workspace. Presentation may react to live state, but the verified market runtime, signal semantics, risk pipeline, paper execution, persistence, replay, and research gates remain unchanged.

## Design system

The CSS architecture is split by responsibility:

- `src/styles/tokens.css` — Obsidian/Ion colors, type, spacing, radius, shadow, and layout tokens.
- `src/styles/typography.css` — bundled variable-font faces, hierarchy, and numeric treatment.
- `src/styles/layout.css` — application shell, header, responsive main region, primary navigation, and secondary drawer.
- `src/styles/components.css` — controls, status semantics, loading/empty states, feature meters, and error UI.
- `src/styles/screens.css` — responsive screen compositions and data visualizations.

The signature palette uses near-monochrome warm-black surfaces and Ion Violet for selection and model emphasis. Emerald remains BUY/positive, red remains SELL/negative, and amber remains warning/risk. All normal operational text meets at least WCAG AA contrast against panel surfaces; operational labels do not use 8–9 px text.

Space Grotesk Variable and JetBrains Mono Variable are bundled locally in Latin and Latin Extended subsets. Numeric UI uses tabular, slashed-zero forms and explicit variable weights rather than relying on a browser fallback font.

## Navigation

The persistent navigation contains four primary destinations:

1. Radar
2. Chart
3. Sinyaller
4. Portföy

Mikroyapı, Araştırma, and Ayarlar remain reachable through the labelled “Daha fazla” drawer. The drawer has dialog semantics, Escape handling, focus containment, and focus return. Gesture-only navigation is deliberately avoided.

## Radar information hierarchy

Radar is an asymmetric, data-first bento rather than an equal-card grid:

- The composite signal core occupies the primary area.
- OBI and CVD are larger critical cells with actual view-session traces.
- Velocity, microprice deviation, VPIN, and detector pressure form a compact supporting rail.
- On narrow screens the supporting rail becomes accessible horizontal scroll-snap content while all destinations remain operable without a gesture.
- The live market tape exposes price, bid, ask, spread, data quality, and regime without duplicating model claims.

The Canvas/rAF radar was replaced by a responsive semantic SVG spectrum with DOM score text and truthful threshold markers. Radar contributions use custom SVG tracks exposed as ARIA meters—not native progress-bar visuals. Detail sheets have dialog semantics, focus containment, Escape dismissal, focus restoration, and accurate feature descriptions.

Price ticks receive a restrained 140 ms buy/sell luminance flash without tweening through fabricated intermediate prices. Composite surfaces receive only a 3–4% directional wash. Both OS-level and application reduced-motion settings suppress the effect.

## Other data presentation

- Lightweight Charts continues to render real candlestick, volume-delta, and flow-pressure canvases; its palette now matches Obsidian/Ion.
- Order-book rows include proportional depth bars; cross-exchange, detector, feature-health, and telemetry sections preserve explicit hierarchy.
- Signal history separates live signal inputs from maturing forward-return outcomes.
- Portfolio, replay, and research tools continue to avoid implying real execution or guaranteed profitability.
- No historical heatmap or sparkline is fabricated. Radar traces contain only snapshots observed while the view is mounted.

## Accessibility and motion

- Visible keyboard focus and practical touch targets are applied globally.
- Interactive state uses `aria-current`, `aria-pressed`, `aria-checked`, status roles, meters, and labelled dialogs.
- Browser zoom remains enabled.
- Loading, empty, warning, disconnected, and error states use semantic text rather than decorative effects.
- Signal confetti and perpetual decorative animation remain removed.

## Deliberately not added

Gesture-only routing, price-number tweening, fake depth history, spider charts, haptic-only feedback, and an “execute” action were not introduced. Existing optional sound/haptic settings remain secondary and accurately described. ClaimMoney remains a research and paper-simulation tool.

## Regression contracts

Stable `data-testid` contracts for connection state, price, navigation, source switching, symbol normalization, paper plan generation, replay, and research import/export remain intact. Browser coverage includes the four-plus-drawer navigation hierarchy, all seven lazy screens, the six semantic Radar meters, accessible detail-sheet focus behavior, bundled theme identity, and horizontal-overflow checks on desktop and mobile.
