# OpenFIRE Google Play Release

This record describes submitted `1.0.2` / code `4`. Android source now prepares unreleased `1.0.3` / code `5` with notification delegation and `POST_NOTIFICATIONS`; see [App Notifications](APP_NOTIFICATIONS.md) for setup and the required next-release checks. No notification-enabled bundle has been uploaded yet.

## App Identity

- Developer account: Jenius Tech (`7637583026798485268`)
- Play Console app ID: `4972903310775044639`
- Package: `com.jenius.openfire`
- App name: OpenFIRE
- Default language: English (United States)
- App/game: App
- Category: Finance
- Price: Free
- Countries/regions: All 178 currently targeted countries/regions (unchanged scope)
- Target SDK: 36
- Minimum SDK: 24 (Android 7.0)
- Privacy policy: https://jeniusapps.com/privacy-policy
- Developer website: https://jeniusapps.com/projects/open-fire
- Support email: support@jeniusapps.com

## Release Artifact

- Version name: 1.0.2
- Version code: 4
- Production variant: release
- Build command: `powershell -ExecutionPolicy Bypass -File scripts/build-android-bundle.ps1`
- AAB path: `android/app-release-bundle.aab`
- SHA-256: a4f93301100e2bb3bb32fe27643b488da90a8c27e451e4344f48d0f38b96f1b6
- Upload certificate fingerprint: 57:AA:0C:02:74:AB:74:DA:B3:A7:7D:8F:EC:2D:A3:4A:A8:79:C1:A6:97:6F:33:64:40:23:96:D8:BD:5E:3A:8B
- Google Play app-signing certificate fingerprint: 2E:70:5E:8E:DE:F4:D7:F4:5B:14:D1:4E:0D:E9:3A:F8:C5:0D:CD:AC:93:64:B1:10:3E:D1:1A:3A:BF:42:73:53
- Digital Asset Links must contain both fingerprints so local release builds and Play-installed builds both verify the TWA and auth callback app link.

## Store Listing

- Listing source: `store-listing/PLAY_STORE_LISTING.md`
- Landing-page artwork source: `store-listing/assets/open-fire-landing.png` (exact copy of `https://jeniusapps.com/assets/projects/open-fire.png`)
- Icon: `store-listing/assets/open-fire-landing.png`
- Feature graphic: `store-listing/assets/feature-graphic-ai.png`
- Phone screenshots: `store-listing/assets/phone/01-dashboard.jpg` through `08-telegram-alerts.jpg`
- Tablet screenshots: Not required by Play Console validation
- Release notes: `store-listing/PLAY_STORE_LISTING.md`
- Console text status: English (United States) listing saved and submitted for review
- Console asset status: Icon, generated feature graphic, and eight phone screenshots uploaded
- AI asset declaration: `feature-graphic-ai.png` labelled as created or edited using AI

## Declarations

- App access: Login required; reusable Google Play reviewer account configured with full access and no trusted-partner testing access
- Ads: No ads
- Target audience: 18 and over
- Content rating: IARC questionnaire applied; Everyone / PEGI 3 / all-ages equivalents, with online content declared
- News: Not a news app
- Government: Not a government app
- Health: No health features
- Financial features: Portfolio tracking and financial education/planning; no transactions, lending, banking, crypto exchange, or financial advice
- Data safety: All five questionnaire steps completed and saved to Publishing overview
- Data safety scope: Email address, user IDs, other financial info, feedback messages, app interactions, in-app search history, and device/other IDs
- Account deletion: https://openfire.jeniusapps.com/account-deletion/ (HTTP 200 and dedicated deletion content verified in production)
- Permissions/sensitive APIs: No sensitive Android permissions; only the app-scoped dynamic receiver permission is present in the merged manifest
- Foreground services: None
- Review video: Not required by Play Console

## Release Status

- Track: Production, full rollout requested
- Play app record: Created
- Initial setup tasks: Complete
- Uploaded: Yes, version code 4 (`1.0.2`), 1.03 MB new-install size. The earlier code 3 upload failed minimum-SDK validation and was not submitted.
- Previewed/confirmed: Yes, package, version, API 24+, target SDK 36, all existing countries, and 100% rollout verified
- Submitted: Yes, the production update was sent for review on 2026-10-16
- Review state: Changes in review; Google Play quick checks are running
- Approved: No
- Rollout: 100% requested across the existing 178 targeted countries/regions; pending Google review
- Public listing URL: https://play.google.com/store/apps/details?id=com.jenius.openfire
- Current public release: `1.0.1` (code 2), released on 2026-08-24; confirmed in Play Console on 2026-10-16
- Remaining blocker: Google Play quick checks, review, and approval of `1.0.2`
- Compatibility: Owner approved raising the minimum to API 24 to satisfy Play automatic protection. Android 5/6 devices no longer receive updates. Play reported 2,031 previously supported device models excluded by this change; this was the only release-preview warning. Automatic protection remains enabled.

## Launcher Icon Validation

- The adaptive logo is a 25%-inset foreground over a matching solid background, keeping the complete flame/shield inside Android's guaranteed safe area. This makes the artwork approximately 21% smaller than the previous 18.5%-inset layout.
- `scripts/validate-android-icons.ps1` checks all five bitmap densities and runs automatically before the release build. The original layout failed this regression check; the corrected layout passes.
- Signed bundle verification, bundletool validation, and `lintRelease` passed. `testReleaseUnitTest` has no source tests.
- The exact bundle was converted to a signed universal APK and installed on a dedicated Android API 34 emulator.
- Run `scripts/test-android-icon-rendering.ps1 -Device <adb-serial>` after installing that APK, with `JAVA_HOME` and `ANDROID_HOME` set. The harness requires SDK build-tools 35.0.0 and platform android-35.
- Its separate test-only APK uses Android's installed adaptive icon drawable, checking circle, rounded-square, squircle, and teardrop masks at 48/72/96 dp. All 12 checks passed for the final smaller-logo `1.0.2` code 4 bundle. Both validation scripts enforce the additional artwork padding as well as clipping safety.
- Local contact sheet: `android/build/icon-validation/icon-masks.png` (ignored build output). Neither the helper APK nor its disposable test-only key is part of the production bundle.
