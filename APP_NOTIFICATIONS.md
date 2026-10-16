# App Notifications

## Events

| Event | Shared content | Schedule in Europe/Brussels | Deduplication |
| --- | --- | --- | --- |
| DCA | Same daily message as email and Telegram, including the personal note and retirement figures | Selected DCA days, 16:00; queue retries until 16:50 | Account/day, then one job per device |
| Risk/alert briefing | Same daily snapshot as Telegram, including current alert cooldown decisions | Selected alert days, 23:00; queue retries until 23:50 | Account/day, then one job per device |
| A week away | Same message as the inactivity email | Hourly check after seven days since the last visit | Once per last-visit timestamp |
| Test | Harmless device confirmation | User action | Own device only; one test per account per 15-minute bucket |

All app categories default off. Use **Menu > App Notifications**, select categories, then explicitly enable the current device. DCA and alert settings link to this settings-only dialog. App preferences do not change email or Telegram preferences. Owner-only feedback forwarding and authentication-provider security emails are outside these reminder categories.

The backend retains account-scoped notification records for delivery and retention, but there is no inbox in the app. Device previews use at most 500 Unicode code points; tapping them opens the dashboard through normal Jenius authentication. User notes are rendered as plain text. Previews may contain financial details, disclosed before opt-in. Settings updates and errors appear in the shared snackbar, not inline banners. The user-facing test notification button has been removed.

## Platforms

Supported desktop/Android browsers can subscribe without installing the PWA. Installed PWAs use the same service worker; installations sharing an origin/subscription do not create duplicate device records. Push is independent of an open dashboard tab, subject to browser/OS permission, connectivity and power policies.

The Android TWA enables trusted-browser notification delegation, declares `POST_NOTIFICATIONS`, and registers Android Browser Helper's permission request activity. Chrome mediates the Android 13+ permission request when the user enables notifications. **1.0.3 / code 5** is built, signed, uploaded and saved in Play Console, but not submitted. The currently published **1.0.2 / code 4** does not include this delegation.

iOS/iPadOS requires an installed Home Screen app on version 16.4 or later. A normal browser tab cannot bypass that platform restriction. Unsupported and denied-permission states are visible in settings.

## Activation

1. Run `node scripts/generate-push-keys.mjs` once in a trusted terminal. Its private output is a secret.
2. Put `OPENFIRE_PUSH_PUBLIC_KEY`, `OPENFIRE_PUSH_PRIVATE_KEY`, and `OPENFIRE_PUSH_SUBJECT=mailto:support@jeniusapps.com` in protected backend environment configuration. Never commit keys or place the private key in client builds. Keep the pair stable across deployments; rotation requires resubscription.
3. Deploy backend and production frontend over HTTPS. Flyway applies `V14__add_app_notifications.sql`. Development builds intentionally disable Angular's service worker.
4. Enable a category/device and verify a scheduled reminder's actual OS display and dashboard click destination. Delivery runs once per minute; provider acceptance alone is not device delivery. The UI no longer offers a test notification button; the authenticated, rate-limited backend test endpoint remains available for controlled operator verification.
5. Build and publish Android 1.0.3 separately using the repository's signed release workflow. Review the new permission, subscription identifiers and financial previews against privacy/Data safety declarations before submission. This implementation does not change the existing Play review.

Missing VAPID configuration disables push delivery, logs a startup warning, and appears in settings. Preferences remain usable without push support.

### Production Deployment

On October 16, 2026, VAPID keys were generated directly on the VPS and saved in OpenFIRE's root-only production environment file, with a root-only backup. The existing deployment watcher recreated the frontend and backend at commit `4599d55`; its final output reported **Deployment complete**. No new persistent containers were added, and other applications were left unchanged.

The PWA does not need a Play Store update. Reopen or refresh it, select notification categories in **App Notifications**, and enable the device. Actual device display has not yet been verified. Android notification delegation still requires publishing the uploaded 1.0.3 / code 5 release; no new Play submission was made during this deployment.

The October 16 live follow-up confirmed owner Google sign-in and the production notification settings. Device registration requires at least one category; all categories were off, so no subscription or test was sent while approval for a temporary DCA opt-in was pending. The separate `test` account needs email verification. Existing Play reviewer credentials failed Jenius sign-in and must be corrected before release submission.

## Safety And Persistence

- Preferences, registration, removal, tests and inbox queries use the authenticated principal, not caller-supplied identities. A subscription cannot be transferred to another account. Registration is limited to ten device records per account.
- PostgreSQL stores subscription URLs and encryption/auth material. Outbound requests are HTTPS-only known browser push-provider hosts, without redirects, with connection/request timeouts. The Web Push library handles AES128GCM encryption and VAPID signing.
- Inbox messages and device jobs commit together. Unique keys and PostgreSQL `FOR UPDATE ... SKIP LOCKED` coordinate workers. Preferences, account status, inactivity and staleness are rechecked before dispatch.
- Network errors, 408/429 and 5xx receive up to five attempts with exponential backoff. Other failures terminate. 404/410 prune only the expired subscription. Acceptance is recorded separately from OS display, which is not guaranteed.
- A crash after provider acceptance but before commit can cause another attempt. Stable notification tags reduce visible duplicates; exactly-once OS delivery is not promised.
- Logout revokes the browser subscription before navigation, with best-effort backend cleanup. Account switching never silently inherits another account's subscription.
- Inbox messages, shared snapshots and inactive subscriptions expire after 90 days. Account deletion cascades account-owned records. Backups and browser-provider retention have separate policies. Logs omit subscription tokens, keys and message bodies.

## Validation

Default backend/Angular tests mock external market/messaging clients. A local crypto test constructs a real encrypted/VAPID-signed request without sending it. Playwright uses five workers and covers direct settings loading without inbox requests, snackbar success/errors, failed-load retry, responsive themes and DCA navigation. Component tests verify that neither enabled nor disabled devices show an inbox or test button.

Deployment preflight regression tests run with `node --test scripts/deploy-linux.test.mjs`. They check that Jenius deployments no longer require the obsolete local password hash while still rejecting required database, market-provider and Keycloak credential placeholders.

Seven opt-in PostgreSQL tests cover the actual Flyway migration, restart/deduplication, concurrent claiming, ownership, schedules, opt-out and expired subscriptions. They create/delete only uniquely named schemas and reject non-loopback database URLs. With a disposable PostgreSQL 16 database using test-only credentials `openfire_test` / `openfire_test`:

```powershell
$env:OPENFIRE_PUSH_TEST_DB_URL='jdbc:postgresql://127.0.0.1:15434/openfire_push_test'
mvn -f backend/pom.xml -Dtest=AppNotificationDatabaseTest test
```

Docker Desktop's Linux engine was unavailable during implementation, so these seven database tests were not run against PostgreSQL. The full Playwright suite has two pre-existing portfolio failures, reproduced unchanged on baseline commit `73f9c46` (watch-only daily-change locator and light-theme metric-label colour); notification tests pass.

## References

- [Angular push payloads and click actions](https://angular.dev/ecosystem/service-workers/push-notifications)
- [Java Web Push library](https://github.com/web-push-libs/webpush-java)
- [Android Browser Helper permission handler](https://github.com/GoogleChrome/android-browser-helper/blob/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/NotificationDelegationExtraCommandHandler.java)
- [Apple Web Push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
