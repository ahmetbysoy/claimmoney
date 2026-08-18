# Dark terminal UI redesign

## Scope

This release replaces the pastel, fixed-phone presentation with a responsive dark market-research workspace. It is a presentation-layer change: the verified market runtime, signal semantics, risk pipeline, paper execution, persistence, replay, and research gates remain unchanged.

## Design system

The interface now uses a small CSS architecture instead of screen-level style objects:

- `src/styles/tokens.css` — color, type, spacing, radius, shadow, and layout tokens.
- `src/styles/typography.css` — readable sans/monospace hierarchy and numeric treatment.
- `src/styles/layout.css` — application shell, header, responsive main region, primary navigation, and secondary drawer.
- `src/styles/components.css` — panels, controls, status semantics, loading/empty states, feature meters, and error UI.
- `src/styles/screens.css` — responsive screen compositions and data visualizations.

Semantic colors are consistent across screens: emerald for BUY/positive, red for SELL/negative, amber for warnings, and blue/cyan for selection and neutral data emphasis. Operational labels do not use 8–9 px text.

## Navigation

The persistent navigation contains four primary destinations:

1. Radar
2. Chart
3. Sinyaller
4. Portföy

Mikroyapı, Araştırma, and Ayarlar remain reachable through the labelled “Daha fazla” drawer. The drawer has dialog semantics, Escape handling, focus containment, and focus return.

## Data presentation

- The continuously animated Canvas radar was replaced by a responsive semantic SVG with DOM text.
- Radar inputs use centered bipolar meters and open explanatory detail panels.
- Chart colors now share the application tokens.
- Order-book rows include proportional depth bars; cross-exchange, detector, feature-health, and telemetry sections have explicit hierarchy.
- Signal history supports direction filtering and presents outcome horizons separately from live signal inputs.
- The portfolio shows a responsive equity sparkline, risk plan, position size, paper orders, and import/export tools without implying real execution.
- Research readiness continues to require mature non-test observations and explicitly avoids profitability claims.

## Accessibility and motion

- Visible keyboard focus and minimum practical touch targets are applied globally.
- Interactive state is exposed through `aria-current`, `aria-pressed`, `aria-checked`, status roles, dialog labels, and native progress elements.
- OS-level reduced-motion preference and the application’s reduced-motion setting suppress transitions and animation.
- Browser zoom is no longer disabled in the viewport metadata.
- Loading, empty, warning, disconnected, and error states use semantic text instead of decorative effects.
- Signal confetti and perpetual decorative animation were removed.

## Deliberately not added

Gesture-only navigation, trading sounds as a primary interaction, spider charts, haptic-only feedback, and an “execute” action were not introduced. Existing optional sound/haptic settings remain secondary and are described accurately. ClaimMoney remains a research and paper-simulation tool.

## Regression contracts

Stable `data-testid` contracts for connection state, price, navigation, source switching, symbol normalization, paper plan generation, replay, and research import/export are preserved. Browser coverage now includes the four-plus-drawer navigation hierarchy, keyboard dismissal/focus, all seven lazy screens, and horizontal-overflow checks on desktop and mobile.
