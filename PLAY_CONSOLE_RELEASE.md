# OpenFIRE Google Play Release

## App Identity

- Developer account: To confirm in Play Console
- Package: `com.jenius.openfire`
- App name: OpenFIRE
- Default language: English (United States)
- App/game: App
- Category: Finance
- Price: Awaiting explicit confirmation
- Countries/regions: Awaiting explicit confirmation
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
- Phone screenshots: Pending capture
- Tablet screenshots: Pending Play Console requirement check
- Release notes: `store-listing/PLAY_STORE_LISTING.md`

## Declarations

- App access: Login required; reviewer instructions pending Play Console setup
- Ads: No ads
- Target audience: Adults; final age-group selection pending Console
- Content rating: Pending questionnaire
- News: Not a news app
- Government: Not a government app
- Health: No health features
- Financial features: Portfolio tracking and financial education/planning; no transactions, lending, banking, crypto exchange, or financial advice
- Data safety: Pending exact artifact and backend review
- Account deletion: Pending verification of the Jenius account-deletion flow and required URL
- Permissions/sensitive APIs: No sensitive Android permissions; only the app-scoped dynamic receiver permission is present in the merged manifest
- Foreground services: None
- Review video: Not expected; pending Console requirements

## Release Status

- Track: Production requested; Console eligibility pending
- Uploaded: No
- Previewed/confirmed: No
- Submitted: No
- Review state: Not submitted
- Approved: No
- Rollout: None
- Public listing URL: Pending
- Remaining blockers: Listing graphics/screenshots, Console app setup and declarations, explicit price/country scope
