# OpenFIRE Design Guide

OpenFIRE is a work-focused financial dashboard for tracking market risk, portfolio positions, DCA reminders, alerts, and retirement progress. The interface should feel dense, calm, and operational: users come here to inspect numbers, compare status, and make small decisions quickly.

## Product Principles

- Prioritize clarity over decoration. Every visible element should help a user understand portfolio risk, progress, or configuration.
- Keep financial concepts distinct. For example, configured `Initial Deposit` is not the same as position cost basis or `Total Invested`.
- Make labels literal and conservative. Avoid clever phrasing around money, risk, or retirement calculations.
- Explain derived metrics with tooltips where ambiguity is likely.
- Preserve fast scanning. Summary values, statuses, and actions should be visually consistent across sections.

## Information Architecture

The logged-in dashboard is organized in this order:

1. Header: theme, alerts, refresh, account actions.
2. DCA panel: contribution reminder status and configuration.
3. Indicator grid: macro and market-risk signals.
4. Retirement planner: retirement configuration, portfolio summary, projections.
5. Portfolio board: holdings, position mix, alerts, edit/delete actions, CSV import/export.

Unauthenticated users see a compact welcome state and account dialogs.

## Visual System

The app uses theme variables defined in `frontend/src/app/app.component.scss` on `app-root`.

Core surfaces:

- `--app-bg`: full-page background.
- `--panel`: major board background.
- `--surface`: nested metric/card background.
- `--metric-bg`: small repeated metric surfaces.
- `--border` and `--border-strong`: separation and emphasis.

Status colors:

- Positive values use `--positive-text` and `--positive-bg`.
- Negative values use `--negative-text` and `--negative-bg`.
- Risk/watch/calm states use `--status-risk`, `--status-watch`, and `--status-calm`.

Shape and spacing:

- Cards and dialogs use small radii, generally `6px` to `8px`.
- Dense dashboard sections should use tight gaps and compact type.
- Avoid nested decorative cards. Use cards only for repeated items, dialogs, and metric containers.

## Typography

- Use compact headings inside dashboards, not landing-page scale type.
- Labels are uppercase, small, and muted.
- Values are bold and right-aligned inside summary rows where comparison matters.
- Avoid negative letter spacing.

## Interaction Patterns

Dialogs:

- Backdrop click or mousedown may close a dialog only when the event target is the backdrop itself.
- Do not use Angular event expressions that return `false` for inside-dialog clicks, because Angular treats `false` as `preventDefault()` and can break native input focus.
- Inputs should be clickable and focusable across their full visible area.

Tooltips:

- Use the existing `app-tooltip` class with `data-tooltip`.
- Add tooltips for derived or easy-to-confuse metrics.
- Keep tooltip copy short, factual, and calculation-oriented.

Buttons:

- Use icon buttons for icon-only actions like refresh, logout, alerts, edit, delete, close.
- Use text buttons for clear commands such as Login, Configure, Add, Save, Export CSV.
- Disabled buttons may show shimmer/loading state but should not block unrelated controls.

## Retirement Planner Rules

Keep these concepts separate:

- `Initial Deposit`: saved retirement configuration value, currently `state.otherSavings`.
- `Total Invested`: sum of cost basis across non-watch-only positions.
- `Portfolio Value`: sum of market value across non-watch-only positions.
- `Total P&L`: unrealized gain/loss across non-watch-only positions.
- `Actual Annualized Return`: annualized return using configured initial deposit and current non-watch-only portfolio value.

Projection starting balance should come from configured `Initial Deposit`, not from portfolio cost basis. Portfolio-derived values can be shown in the summary, but they should not silently replace retirement configuration values.

## Portfolio Board Rules

- Watch-only positions should be visually distinct and excluded from P&L-style calculations.
- Position type/category UI should support scanning by both count and value.
- Edit/delete controls should remain compact and consistently placed.
- Import/export actions should live in the portfolio heading action group.

## Accessibility

- Dialogs should use `role="dialog"` or `role="alertdialog"` with `aria-modal="true"` and a labelled heading.
- Icon-only buttons need `title` and `aria-label`.
- Tooltip-bearing elements should include an accessible label when the tooltip explains the field.
- Avoid relying on color alone for positive/negative/risk meaning; pair colors with labels or signs where possible.

## Implementation Notes

- Frontend: Angular standalone components under `frontend/src/app/components`.
- Shared state and API calls: `frontend/src/app/market-dashboard.service.ts`.
- Models: `frontend/src/app/market-dashboard.models.ts`.
- Backend: Spring Boot under `backend/src/main/java`.
- Database migrations: `backend/src/main/resources/db/migration`.

Run frontend verification with:

```powershell
cd frontend
npm run build
```

The current build may emit size-budget warnings; treat new warnings as a design/implementation smell and reduce generated template/CSS bulk when practical.
