# Project Rules

Follow `NEXT_PROJECT_RULES.md` for repository-wide implementation, testing, Git, and deployment rules.

## Google Play Publishing

- Treat this repository as the source of truth for OpenFIRE (`com.jenius.openfire`).
- Production releases use the `release` variant. Never upload debug or experimental variants.
- Derive version name/code from `android/twa-manifest.json` and SDK levels from `android/app/build.gradle`.
- Keep the repository public and never commit signing keys, passwords, Play credentials, or generated release bundles.
- Read `PLAY_CONSOLE_RELEASE.md`, `store-listing/PLAY_STORE_LISTING.md`, and `$publish-android-play` before Play work.
- Build with `powershell -ExecutionPolicy Bypass -File scripts/build-android-bundle.ps1` from the repository root after setting the two Bubblewrap password environment variables.
- Upload only `android/app-release-bundle.aab`.
- Reuse the established `open-fire-upload` key and verify signing, package, version, SDKs, permissions, dependencies, listing assets, declarations, and tests before upload.
- Answer declarations and Data safety from the exact release artifact, web application behavior, backend behavior, and third-party SDK behavior.
- Prefer the user's signed-in Chrome session. Search for `com.jenius.openfire` before creating an app and resume drafts rather than duplicating them.
- Set price and countries only from explicit user authorization. Stop for legal terms, legal-representation statements, pricing changes, destructive actions, or unexpected policy blockers.
- Treat **Changes in review** as submitted, not publicly available.
- Stage only intentional release changes, commit them to `main`, and push to `origin`.
