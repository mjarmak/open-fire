---
name: android-review-feedback-dialog
description: Add or adapt an Android in-app review and feedback dialog with a Google Play action, email contact, and controlled repeat prompts. Use when an Android app needs this dialog, especially when a side panel or overlay must hand the prompt off to the main app.
---

# Android review and feedback dialog

Adapt this behavior to the target app's UI framework and existing navigation. Read its repository rules and current prompt code first. Derive the application ID and support email from that app; never copy another product's identifiers or contact details.

For reusable project rules, adapt [assets/AGENTS.review-feedback.rules.md](assets/AGENTS.review-feedback.rules.md) into the target repository's `AGENTS.md` while preserving its other rules.

## Interaction contract

- Show the dialog in the main app Activity only. A side panel, floating window, or other overlay may queue the prompt but must not render it.
- Offer **Review on Google Play**, **Email feedback**, and a dismiss action. The email path should welcome issues and feature requests. Do not add stars unless the product owner asks for them.
- Keep a settings button that opens the dialog every time, including after the user has tapped Review.
- Track that the user **tapped Review**, not that they submitted a review. Persist this flag and permanently suppress automatic prompts after the tap. Dismissal and email do not set it.
- For automatic app-return prompts, count only returns to the main app after it was backgrounded or minimized. Do not count the first launch, Activity recreation, or panel expansion/collapse. Show on the first qualifying return; after an automatic prompt, require five subsequent qualifying returns before showing another.
- If the app has a side panel, count completed panel openings from every real entry path, including edge gestures. On each 20th completed opening, queue one prompt. Wait for the user's normal panel-close path, then show it in the main app. A failed gesture, handle appearance, or view recreation is not an opening. Keep this milestone separate from the app-return cadence.
- When both triggers occur together, show one dialog and consume each pending signal once. Never stack dialogs or show a prompt over another app.

## Implementation guidance

Keep the counters, next eligible app return, Review-tapped flag, and pending panel milestone in persistent app state. Use the main Activity's visible lifecycle to consume pending prompts. A panel service should report completed opens and normal closes, then request navigation to the main app only when a milestone is pending. Make this handoff safe across process death and repeated lifecycle callbacks.

Build the Play destination from the target app's application ID. Prefer its `market://details?id=...` listing with an HTTPS Play listing fallback; handle the absence of a browser or Play handler without crashing. Use an email-only `mailto:` intent addressed to the target app's support contact, with a readable fallback if no email app is installed. Keep any support address out of hardcoded generic skill files.

## Verification

Test the state transitions and the actual UI route:

1. No automatic dialog on fresh launch; first minimize-and-return shows it. The next four qualifying returns do not, and the fifth does.
2. Panel openings 1–19 do not prompt. Opening 20 queues one prompt; the panel itself stays free of the dialog; closing it shows exactly one dialog in the main app. Repeat for opening 40.
3. Dismissal and email leave automatic eligibility intact. Review tap suppresses future automatic prompts, while the settings button still opens the dialog.
4. Rotate or recreate the Activity, relaunch the process, and exercise the real edge gesture if applicable. Verify no duplicate count or overlay-hosted dialog.
5. Verify both external actions and their no-handler fallbacks.

Do not push or publish as part of applying this skill unless the user requests it.
