# Review and feedback dialog rules

- Derive the Google Play listing from this app's application ID and use this app's configured support email. Do not reuse another product's package name, store URL, or contact address.
- Render the review/feedback dialog only inside the main app UI (native Activity or TWA app page). Overlay windows and side panels may signal that a prompt is due, but must not display it.
- Style the dialog from this app's active theme tokens for surface, text, actions, and outlines. Match the app's typography and shape. Do not copy another app's fixed colors; respond to light/dark and runtime theme changes, including system dynamic color when supported. Verify contrast and interaction states in every supported theme.
- Provide Review on Google Play, Email feedback for issues and feature ideas, and a dismiss action. Keep a manual settings entry that always reopens the dialog. Show stars only if explicitly requested.
- Persist a `reviewTapped` flag when the user taps Review. It records intent to visit Play, not a completed review. Never show automatic prompts after that tap; keep the manual entry available. Email and dismissal do not set this flag.
- Count only genuine returns to the main app after backgrounding for automatic app-return reminders. Do not count initial launch, Activity recreation, or side-panel expansion. Prompt on the first qualifying return, then wait five further qualifying returns after an automatic prompt before prompting again.
- If this app has a side panel, count completed openings from all entry paths. Queue a prompt on each 20th completed opening, and show it only after the user's normal panel close brings the main app forward. Keep this cadence separate from the app-return reminder.
- Deduplicate simultaneous triggers, consume queued prompts once, and never display the dialog over another app.
- Handle missing Google Play, browser, and email handlers without crashing. Verify the 5-return and 20-opening boundaries with state tests and an actual device or emulator UI flow.
