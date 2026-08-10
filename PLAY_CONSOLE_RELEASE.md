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
- Icon: `frontend/public/openfire-logo-dark-v2-512.png`
- Feature graphic: `store-listing/assets/feature-graphic.png`
- Phone screenshots: `store-listing/assets/phone-welcome.png`, `store-listing/assets/phone-dashboard.png`
- Tablet screenshots: Pending Play Console requirement check
- Release notes: `store-listing/PLAY_STORE_LISTING.md`
- Console text status: English (United States) descriptions saved as a draft
- Console asset status: Pending Chrome extension access to local files

## Declarations

- App access: Login required; reusable reviewer credentials required by Google Play
- Ads: No ads
- Target audience: Adults; final age-group selection pending Console
- Content rating: Pending questionnaire
- News: Not a news app
- Government: Not a government app
- Health: No health features
- Financial features: Portfolio tracking and financial education/planning; no transactions, lending, banking, crypto exchange, or financial advice
- Data safety: All five questionnaire steps answered in a draft; submission is blocked until sign-in details and target audience are complete
- Data safety scope: Email address, user IDs, other financial info, feedback messages, app interactions, in-app search history, and device/other IDs
- Account deletion: https://openfire.jeniusapps.com/account-deletion/ (HTTP 200 verified; production currently serves the Angular shell at this route, so the dedicated deletion content still needs deployment verification)
- Permissions/sensitive APIs: No sensitive Android permissions; only the app-scoped dynamic receiver permission is present in the merged manifest
- Foreground services: None
- Review video: Not expected; pending Console requirements

## Release Status

- Track: Production requested; Console eligibility pending
- Play app record: Created
- Initial setup tasks: 6 of 11 complete
- Uploaded: No
- Previewed/confirmed: No
- Submitted: No
- Review state: Not submitted
- Approved: No
- Rollout: None
- Public listing URL: Pending
- Remaining blockers: Reviewer sign-in account, IARC terms confirmation/content rating, Chrome local-file upload permission, dedicated account-deletion page deployment, target audience, Data Safety submission, AAB upload, country selection, and release review
