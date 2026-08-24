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
- Countries/regions: All 176 available countries/regions plus rest of world selected
- Target SDK: 36
- Minimum SDK: 21
- Privacy policy: https://jeniusapps.com/privacy-policy
- Developer website: https://jeniusapps.com/projects/open-fire
- Support email: support@jeniusapps.com

## Release Artifact

- Version name: 1.0.1
- Version code: 2
- Production variant: release
- Build command: `powershell -ExecutionPolicy Bypass -File scripts/build-android-bundle.ps1`
- AAB path: `android/app-release-bundle.aab`
- SHA-256: cad80d363d1a3fe696dbf08330f7eb9c3af8ecfd0b4cc7a67f24a4fcb2c389a4
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
- Uploaded: Yes, AAB version code 2 (`1.0.1`), 1.09 MB new-install size
- Previewed/confirmed: Yes
- Submitted: Yes, the production update was sent for review on 2026-08-24
- Review state: Changes in review; Google Play quick checks are running
- Approved: No
- Rollout: 100% requested across all 177 targeted countries/regions; pending Google review
- Public listing URL: https://play.google.com/store/apps/details?id=com.jenius.openfire
- Current public release: `1.0.0`, published on 2026-08-18
- Remaining blocker: Google Play quick checks, review, and approval of `1.0.1`
