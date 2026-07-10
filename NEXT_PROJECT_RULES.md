# Next Project Rules

Use this file as the project rules document for a new repository. Keep it close to the codebase, for example as `AGENTS.md`, `.cursor/rules.md`, or `PROJECT_RULES.md`.

## Operating Principles

- Read the existing code before changing it. Prefer local patterns, naming, architecture, and test style over introducing a new approach.
- Keep changes scoped to the request. Do not refactor unrelated code unless it is necessary to make the requested change correct.
- Preserve user work. Never revert, overwrite, or reset changes that were not made for the current task.
- Avoid destructive commands such as `git reset --hard`, forced checkout, or recursive deletion unless the user explicitly asks for them.
- Use structured parsers, framework APIs, and typed models instead of ad hoc string parsing when reasonable.
- Prefer small, direct abstractions only when they remove real duplication or make behavior safer.
- When behavior depends on current external data, live APIs, packages, regulations, prices, schedules, or vendor behavior, verify against current sources before assuming.
- Treat security, authentication, credentials, and user data as high-risk areas. Do not log secrets, expose tokens, or weaken validation for convenience.

## Implementation Standards

- Make the product behavior complete, not just technically compiling.
- Validate edge cases around loading, empty states, errors, permissions, retries, and slow APIs.
- Keep UI text short and actionable.
- Prefer server-side validation for trusted decisions and client-side validation for fast user feedback.
- For public APIs, keep request and response contracts stable unless the task explicitly changes them.
- For database changes, include migrations or compatibility handling and consider existing production data.
- For config changes, document required environment variables and safe defaults.

## Frontend Rules

- Build the actual usable screen first. Do not create marketing or placeholder pages unless requested.
- Match the existing design system and component patterns.
- Keep operational apps dense, scannable, and efficient. Avoid decorative layouts that reduce workflow clarity.
- Use clear controls: buttons for actions, toggles for binary state, tabs for view switches, inputs/selects for data entry, and tooltips for icon-only controls.
- Make loading, disabled, success, empty, and error states visible.
- Do not let text overflow, overlap, or resize fixed controls unexpectedly.
- Keep responsive behavior explicit with flex/grid constraints, min/max widths, and stable dimensions for repeated UI elements.
- Use accessible labels, keyboard-reachable controls, and reasonable aria attributes for dialogs, live regions, and status messages.

## Backend Rules

- Keep controllers thin. Put business rules in services and provider-specific behavior in clients/adapters.
- Normalize external-provider identifiers at boundaries and store canonical values when possible.
- Handle provider failures gracefully with fallback logic only when it preserves correctness.
- Do not hide data quality problems silently. Return clear errors or explicit empty states.
- Use typed request/response models and validation annotations where available.
- Keep caching keyed by all inputs that affect the response, including user, provider, token, symbol, range, and feature flags.
- Live API tests must be opt-in when they depend on network, rate limits, or paid tokens.

## Testing Rules

- Add or update tests for every meaningful behavior change.
- Use mocked data to validate math and branching deterministically.
- Use live API smoke tests only behind explicit environment gates.
- For bug fixes, add a regression test that fails before the fix and passes after it.
- Run targeted tests first, then the relevant full suite before committing.
- If a test cannot be run, state the exact reason and what was verified instead.

## Error Handling

- Surface actionable error messages in the UI.
- Distinguish validation/auth failures from server failures.
- For 5xx errors, offer a path for the user to report feedback or diagnostics when the app supports it.
- Keep partial failures local when possible. Do not block the whole page if independent sections can still load.
- Log enough server-side context to debug without logging secrets or personal data.

## Git Workflow

- Always check `git status` before editing and before committing.
- Commit all completed requested changes.
- Push completed commits to the current branch unless the user explicitly says not to.
- Keep commits logically scoped. Use multiple commits when unrelated completed tasks are pending.
- Use concise commit messages in imperative style, for example `fix: handle server error feedback`.
- Before final response, verify the worktree is clean after commit/push.

## Final Response Rules

- State what changed, what was verified, and the commit hash when changes were committed.
- Mention skipped tests or known warnings clearly.
- Keep the final response concise and factual.
