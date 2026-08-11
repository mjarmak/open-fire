# OpenFIRE Google Play Release

## App Identity

- Developer account: Jenius Tech (`7637583026798485268`)
- Play Console app ID: `4972903310775044639`
- Package: `com.jenius.openfire`
- App name: OpenFIRE
- Default language: English (United States)
- App/game: App
- Category: Finance
- Price: Free
- Countries/regions: All available countries/regions authorized; selection pending release setup
- Target SDK: 36
- Minimum SDK: 21
- Privacy policy: https://jeniusapps.com/privacy-policy
- Developer website: https://jeniusapps.com/projects/open-fire
- Support email: support@jeniusapps.com

## Release Artifact

- Version name: 1.0.0
- Version code: 1
- Production variant: release
- Build command: `powershell -ExecutionPolicy Bypass -File scripts/build-android-bundle.ps1`
- AAB path: `android/app-release-bundle.aab`
- SHA-256: 6163650ed8dce33e24291e74348171373cdcb807c6f7c3312f5470300f8b9488
- Signing certificate fingerprint: 57:AA:0C:02:74:AB:74:DA:B3:A7:7D:8F:EC:2D:A3:4A:A8:79:C1:A6:97:6F:33:64:40:23:96:D8:BD:5E:3A:8B

## Store Listing

- Listing source: `store-listing/PLAY_STORE_LISTING.md`
- Landing-page artwork source: `store-listing/assets/open-fire-landing.png` (exact copy of `https://jeniusapps.com/assets/projects/open-fire.png`)
- Icon: `store-listing/assets/open-fire-landing.png`
- Feature graphic: `store-listing/assets/feature-graphic-ai.png`
- Phone screenshots: `store-listing/assets/phone/01-dashboard.jpg` through `08-telegram-alerts.jpg`
- Tablet screenshots: Pending Play Console requirement check
- Release notes: `store-listing/PLAY_STORE_LISTING.md`
- Console text status: English (United States) descriptions saved as a draft
- Console asset status: Pending Chrome extension access to local files; artwork and screenshots are ready

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
- Review video: Not expected; pending Console requirements

## Release Status

- Track: Production requested; Console eligibility pending
- Play app record: Created
- Initial setup tasks: 10 of 11 complete
- Uploaded: No
- Previewed/confirmed: No
- Submitted: No
- Review state: Not submitted
- Approved: No
- Rollout: None
- Public listing URL: Pending
- Remaining blockers: Chrome local-file upload permission, Store Listing asset upload, AAB upload, country selection, and release review
