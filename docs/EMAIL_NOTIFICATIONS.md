# OpenFIRE Email Reminders

Delivery uses Novu, like Open Remixer, with an OpenFIRE-owned environment, API key and email integration. Do not modify another application's workflows or sender.

## Setup

1. Configure the OpenFIRE Novu email integration with the authorized Hostinger alias **openfire@jeniusapp.com**, display name **OpenFIRE**. SMTP credentials stay in Novu, never in this public repository. Verify the mailbox integration permits that From alias.
2. Create active email-only workflows `open-fire-dca` and `open-fire-return`, each with one immediate email step. Subject: `{{payload.subject}}`; custom HTML body: `{{payload.html}}`; plain-text alternative: `{{payload.text}}`. The app supplies branded HTML including its public logo and dashboard link.
3. Set `OPENFIRE_NOVU_API_URL` (API root serving `/v1/events/trigger`), `OPENFIRE_NOVU_API_KEY` (OpenFIRE-specific secret), and optionally `OPENFIRE_PUBLIC_APP_URL` (default `https://openfire.jeniusapps.com`) in protected backend environment configuration. Docker forwards these via its existing env file.
4. Ensure Jenius tokens include `email` and boolean `email_verified`. Addresses come only from authenticated tokens, never browser input.

No delivery occurs with blank Novu settings. Both email categories default off and can be enabled independently in **DCA Configure**.

## Scheduling

- DCA follows Telegram's selected days at **16:00 Europe/Brussels**, including daylight saving. It does not require Telegram enabled or a chat ID. Content uses the same retirement calculations and personal DCA note.
- Return reminder: one email per absence, at least seven days after the last app visit. Loading DCA settings on app launch records activity. Background market requests do not reset this timer. Enabling return reminders starts a fresh seven-day wait.
- Disabled accounts, unverified addresses and opted-out categories are skipped. Eligibility is rechecked under an account lock before sending.
- Accepted event keys persist in PostgreSQL, preventing repeats after restarts. Novu receives the same idempotency key on retries. DCA retries every ten minutes until 16:50; return reminders retry hourly. No old DCA backlog is replayed.
- Email failure does not block Telegram. Novu acknowledgement means accepted, not delivered to the inbox; inspect Novu/provider activity for actual SMTP status.

Tests mock delivery and database access, never sending real emails. Enable production only after the OpenFIRE workflows and Hostinger sender are configured.
