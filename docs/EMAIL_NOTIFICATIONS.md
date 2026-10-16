# OpenFIRE Email Reminders

Delivery uses the existing self-hosted Novu service on the Jenius VPS, like Temper. The dashboard is https://emails.jeniusapps.com; Novu Cloud is not needed. Use an OpenFIRE-owned API key and email integration, with a separate environment where the installed edition supports it. Do not modify another application's workflows or sender.

## Setup

1. Configure an active, non-primary OpenFIRE Novu email integration with identifier **open-fire-smtp**, Hostinger alias **openfire@jeniusapps.com**, and display name **OpenFIRE**. The live Hostinger domain is `jeniusapps.com` (plural); the alias must exist before sending. SMTP credentials stay in Novu, never in this public repository. Verify the mailbox integration permits that From alias.
2. Create active email-only workflows `open-fire-dca` and `open-fire-return`, each with one immediate email step. Subject: `{{payload.subject}}`; custom HTML body: `{{payload.html}}`; plain-text alternative: `{{payload.text}}`. The app supplies branded HTML including its public logo and dashboard link.
3. Set `OPENFIRE_NOVU_API_URL` (API root serving `/v1/events/trigger`), `OPENFIRE_NOVU_API_KEY` (OpenFIRE-specific secret), and optionally `OPENFIRE_PUBLIC_APP_URL` (default `https://openfire.jeniusapps.com`) in protected backend environment configuration. Docker forwards these via its existing env file.
4. Ensure Jenius tokens include `email` and boolean `email_verified`. Addresses come only from authenticated tokens, never browser input.

The public API root is `https://emails.jeniusapps.com/api` (not the dashboard root). On the VPS, host tooling can use `http://127.0.0.1:3100`. Temper uses `http://novu-api:3000` on the private `jenius-novu_default` Docker network; OpenFIRE must join that network before using the same private URL. Verify the live topology before choosing either connection. Never copy Temper's API key or change its SMTP integration for OpenFIRE.

No delivery occurs with blank Novu settings. Both email categories default off and can be enabled independently in **DCA Configure**.

Every trigger explicitly selects `overrides.email.integrationIdentifier: open-fire-smtp` and supplies the plain-text alternative via `overrides.email.text`. This prevents OpenFIRE from using another app's primary sender. A missing or inactive integration must fail rather than silently falling back. See [Novu email routing](https://docs.novu.co/platform/integrations/email).

## Scheduling

- DCA follows Telegram's selected days at **16:00 Europe/Brussels**, including daylight saving. It does not require Telegram enabled or a chat ID. Content uses the same retirement calculations and personal DCA note.
- Return reminder: one email per absence, at least seven days after the last app visit. Loading DCA settings on app launch records activity. Background market requests do not reset this timer. Enabling return reminders starts a fresh seven-day wait.
- Disabled accounts, unverified addresses and opted-out categories are skipped. Eligibility is rechecked under an account lock before sending.
- Accepted event keys persist in PostgreSQL, preventing repeats after restarts. Novu receives the same idempotency key on retries. DCA retries every ten minutes until 16:50; return reminders retry hourly. No old DCA backlog is replayed.
- Email failure does not block Telegram. Only a Novu response with `acknowledged: true` and `status: processed` records acceptance. This means accepted, not delivered to the inbox; inspect Novu/provider activity for actual SMTP status.

Tests mock delivery and database access, never sending real emails. Enable production only after the OpenFIRE workflows and Hostinger sender are configured.

## Live Setup Status (October 16, 2026)

- Novu Development contains inactive OpenFIRE DCA and plan-check-in drafts with the expected payload subject/HTML bindings. They are not confirmed published to Production.
- Integration Store currently shows only Temper's Production SMTP provider. It was left unchanged. Create the separate non-primary `open-fire-smtp` integration before enabling OpenFIRE delivery.
- Hostinger shows three aliases on `contact@jeniusapps.com`; the requested OpenFIRE alias is absent. Creating it is pending specific owner approval after automatic review rejected creating an alias under the earlier instruction to use an existing one.
- Protected OpenFIRE Novu credentials and SMTP configuration still need confirmation. The prior VPS browser-console session expired, and the console launcher did not open a replacement through automation.
- No live smoke email was sent. An explicitly approved recipient, working provider, active app workflows, and SMTP/inbox evidence are still required. Do not interpret workflow drafts or trigger acknowledgements as delivery.
