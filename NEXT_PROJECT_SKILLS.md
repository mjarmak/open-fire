# Next Project Skills

Use this file as a reusable skill and workflow playbook for a new project. It is intended for AI coding agents and human collaborators.

## Skill: Repository Orientation

When starting work:

1. Check `git status`.
2. Identify the stack, package manager, test commands, build commands, and app entry points.
3. Read the relevant files before proposing or editing code.
4. Locate existing tests for the area being changed.
5. Summarize the likely change path before editing if the task is broad.

Expected output:

- Relevant files identified.
- Existing conventions understood.
- No unrelated files touched.

## Skill: Bug Fix

Use when the user reports broken behavior.

1. Reproduce or reason from the exact error path.
2. Find the smallest code path responsible for the bug.
3. Add a regression test when feasible.
4. Fix the root cause, not just the visible symptom.
5. Run targeted tests, then the relevant full suite.
6. Commit and push.

Quality bar:

- The same failure should not recur for the reported case.
- Nearby equivalent cases should be covered when cheap and useful.

## Skill: Feature Implementation

Use when adding product behavior.

1. Confirm existing domain models and UI patterns.
2. Implement backend/API changes before frontend wiring when data contracts are involved.
3. Add UI states for loading, disabled, error, empty, and success paths.
4. Add tests at the lowest useful level plus integration/UI tests for important flows.
5. Build and run the relevant test suite.
6. Commit and push.

Quality bar:

- Feature works end to end.
- Existing behavior remains compatible unless intentionally changed.

## Skill: Frontend UI Change

- Reuse the existing shared dialog animations for modal backdrops and panels.
- For trigger-based dialogs, anchor the desktop panel to its trigger, clamp it within the viewport, and retain the established mobile dialog layout.

Use for dialogs, forms, dashboards, controls, snackbars, charts, and layout.

Checklist:

- Match existing component and style conventions.
- Keep text concise and action-oriented.
- Use stable layout constraints so content does not jump or overlap.
- Make disabled/loading states visually clear.
- Ensure mobile and desktop layouts remain usable.
- Add or update component tests when behavior changes.
- Run frontend tests and production build.

Verification commands:

```bash
npm test -- --watch=false
npm run build
```

## Skill: Backend/API Change

Use for controllers, services, clients, scheduled jobs, integrations, and persistence.

Checklist:

- Keep request validation explicit.
- Keep provider-specific transformations in provider clients/adapters.
- Normalize external identifiers at boundaries.
- Preserve existing database data and migrations.
- Avoid swallowing exceptions unless a fallback is intentionally selected.
- Add service/client/controller tests depending on the behavior changed.

Verification commands:

```bash
mvn test
```

Adjust the command for Gradle, npm, pnpm, yarn, pytest, cargo, or the stack in use.

## Skill: External API Integration

Use when working with market APIs, payment APIs, messaging APIs, auth providers, or other external systems.

Checklist:

- Read current provider docs when behavior may have changed.
- Keep provider clients isolated from business logic.
- Use deterministic mocked tests for normal, empty, malformed, auth, rate-limit, and server-error responses.
- Add opt-in live smoke tests behind environment variables for real API checks.
- Store canonical provider identifiers when useful, but accept common aliases at input boundaries.
- Respect provider rate limits and token availability.

Live test rule:

- Never make live tests run by default in CI unless the project explicitly provisions tokens and rate limits for it.

## Skill: Data And Math Validation

Use for portfolio calculations, risk metrics, indicators, charts, prices, balances, or reports.

Checklist:

- Test multiple deterministic examples with known expected values.
- Include boundary cases such as zero quantity, missing price, negative change, watch-only positions, and empty history.
- Use fixed dates/times in tests.
- Avoid floating-point surprises by using decimals for money and percentages when the language supports it.
- Compare rounded outputs at the same precision the product displays or stores.

## Skill: Error Handling And Feedback

Use when changing errors, retries, notifications, or feedback flows.

Checklist:

- Separate auth errors, validation errors, network errors, rate limits, and 5xx server errors.
- Let independent page sections continue when one section fails.
- Provide a clear action when the user can recover.
- For 5xx errors, provide a feedback/report path if the product supports it.
- Avoid exposing stack traces, secrets, or provider tokens in UI messages.

## Skill: Deployment Script Change

Use when changing Docker, deploy scripts, ports, environment variables, registry handling, or server startup.

Checklist:

- Keep scripts POSIX-compatible when they are run with `sh`; use Bash-only features only with a Bash shebang.
- Allow frontend and backend ports to be configured by environment variables.
- Make generated frontend API URLs match the configured backend URL.
- Validate required environment variables early with clear messages.
- Avoid hardcoded registry hosts or namespaces when deployment config should control them.
- Test script syntax locally where possible.

## Skill: Code Review

Use when asked to review.

Report in this order:

1. Bugs and regressions by severity.
2. Missing tests or verification gaps.
3. Security, data, and operational risks.
4. Open questions.
5. Short summary.

Review rules:

- Cite file and line references.
- Do not lead with praise.
- If no issues are found, say that clearly and state residual risk.

## Skill: Commit And Push

Use after completing any code or documentation change.

Steps:

1. Run relevant tests/builds.
2. Check `git status --short`.
3. Stage only intended files.
4. Commit with a concise message.
5. Push to the current branch.
6. Confirm the worktree is clean.

Commit message examples:

```text
fix: handle server error feedback
feat: add configurable backend port
test: cover portfolio risk calculations
docs: add project agent rules
```
