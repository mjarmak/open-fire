# Database Index Coverage

`V16__index_database_filter_paths.sql` adds 15 indexes after auditing runtime SQL across the backend. Existing primary-key, unique, expression, pagination and queue indexes are retained. No user data, preferences or uniqueness rules change.

## Query Coverage

| Table | Filtering / ordering | Coverage |
| --- | --- | --- |
| `users` | Exact username, upserts, row locks | Existing username primary key |
| `users` | Case-insensitive username | Existing unique `lower(username)` index |
| `users` | OIDC subject identity | Existing partial unique subject index |
| `users` | Nonempty Telegram recipients | New partial `users_telegram_recipients_idx` |
| `users` | Telegram DCA recipients, including the existing `coalesce` predicate | New partial `users_telegram_dca_recipients_idx` |
| `users` | Enabled, verified, opted-in email DCA recipients on a selected day | New partial GIN `users_email_dca_days_idx` on `string_to_array(telegram_dca_days, ',')` |
| `users` | Enabled, verified email return recipients with an old `last_app_visit` | New partial `users_email_return_due_idx (last_app_visit, username)` |
| `portfolio_holdings` | Owner and symbol, batch alert timestamp updates | Existing `(username, symbol)` index |
| `portfolio_holdings` | Row ID plus ownership checks | Existing ID primary key locates the row; no duplicate `(username, id)` index needed |
| `portfolio_holdings` | Owner followed by `watch_only, symbol, id` ordering | New `portfolio_holdings_user_order_idx` |
| `portfolio_holdings` | Owner and recent alert timestamp | New partial `portfolio_holdings_alert_cooldown_idx` |
| `feedback_messages` | ID updates, newest-first listing, case-insensitive owner | Existing primary key, timestamp and `lower(username)` indexes |
| `feedback_messages` | Exact owner for foreign-key cascading deletes | New `feedback_messages_owner_idx`; the lowercase expression index does not cover this equality |
| `email_deliveries` | Event-key conflict/deduplication | Existing primary key; `accepted_at` is not a runtime filter |
| `app_notification_preferences` | Account lookup, upsert and join | Existing username primary key |
| `app_notification_preferences` | DCA / briefing / return opted-in recipient scans | Three new partial username indexes, one per true category |
| `web_push_subscriptions` | ID, ID plus owner, per-owner device counts and queueing | Existing ID primary key and username index |
| `web_push_subscriptions` | Expired `updated_at` cleanup | New `web_push_subscriptions_updated_at_idx` |
| `app_notifications` | Event deduplication, ID joins, owner/cursor pagination | Existing event-key unique index, ID primary key and `(username, id desc)` index |
| `app_notifications` | Expired `created_at` cleanup | New `app_notifications_created_at_idx` |
| `web_push_deliveries` | Notification/device pair and notification cascades | Existing `(notification_id, subscription_id)` primary key |
| `web_push_deliveries` | Unfinished jobs due by timestamp, oldest first | Existing partial `web_push_deliveries_due_idx` |
| `web_push_deliveries` | Device joins and subscription cascades | New `web_push_deliveries_subscription_idx`; the primary key's second column alone does not cover this path efficiently |
| `notification_message_snapshots` | Event-key lookup/deduplication | Existing primary key |
| `notification_message_snapshots` | Account cascade and expired `created_at` cleanup | New username and timestamp indexes |

The DCA email query uses array containment (`@> array[?]::text[]`) instead of scalar `= any(...)`, allowing PostgreSQL's GIN array operator class to use the day index. Tests compare both expressions across all seven schedule days.

Boolean eligibility flags are represented by partial-index predicates rather than redundant standalone boolean indexes. Owner/ID queries already finding a single row through a primary key do not need separate indexes for every residual check. Filtering performed after retrieval in Java is not a database query path. PostgreSQL's own catalog/activity views are not application tables and are not modified.

## Application And Recovery

Flyway applies V16 on the next normal backend migration/deployment. It uses `CREATE INDEX CONCURRENTLY` so normal inserts, updates and deletes can continue. Its companion `.sql.conf` sets `executeInTransaction=false`. The backend retains ordinary transactional migrations but uses PostgreSQL session-level advisory migration locks, as required for concurrent builds. Do not wrap this migration in a transaction or run Flyway with transactional advisory locking enabled.

Concurrent builds still consume CPU, I/O and temporary disk, can wait for long-running transactions, and add ongoing write/storage cost. PostgreSQL may legitimately choose a sequential scan when a filter matches most rows. An index makes a suitable access path available; it does not force the planner to use it.

This is a nontransactional migration: interruption may leave some completed indexes or an invalid index. Before retrying, inspect `pg_index.indisvalid` / `indisready` and the Flyway history. `IF NOT EXISTS` supports retrying completed indexes but does not repair invalid ones or verify their definition. An operator must remove only the affected invalid V16 index with `DROP INDEX CONCURRENTLY`, repair failed Flyway history after investigation, then rerun the migration. Do not delete or edit a previously applied migration.

Rollback is a new forward migration dropping only the 15 V16 indexes, concurrently and nontransactionally. The older indexes and application data remain intact; the array-containment query is correct even without its GIN index.

## Validation

`DatabaseMigrationServiceTest` checks Flyway session locking and the per-script transaction configuration without a database. `DatabaseIndexMigrationTest` uses real PostgreSQL and synthetic data to check index validity, upgrade/rerun behavior, preserved preferences/data, referencing-side foreign-key coverage, query plans for every new index, all-day schedule equivalence, and writes during a concurrent build. Tests create/drop only uniquely named schemas and reject non-loopback database URLs.

Example for a disposable PostgreSQL 16 database with test-only credentials `openfire_test` / `openfire_test`:

```powershell
$env:OPENFIRE_INDEX_TEST_DB_URL='jdbc:postgresql://127.0.0.1:15436/openfire_index_test?connectTimeout=5&socketTimeout=30'
$env:OPENFIRE_PUSH_TEST_DB_URL=$env:OPENFIRE_INDEX_TEST_DB_URL
mvn -f backend/pom.xml '-Dtest=DatabaseMigrationServiceTest,DatabaseIndexMigrationTest,AppNotificationDatabaseTest' test
```

Query-plan fixtures are synthetic and selective; they are not a production-sized benchmark. No live production database, market provider or messaging API is used by these checks.

Verified on October 25, 2026 against PostgreSQL 16.14: all five index integration tests and eight notification database tests passed. The clean full backend run passed 222 tests; six live-provider tests remained opt-in and were skipped. These checks applied V16 only to disposable local schemas, not the production database.

## References

- [PostgreSQL CREATE INDEX and concurrent builds](https://www.postgresql.org/docs/16/sql-createindex.html)
- [Flyway PostgreSQL advisory lock configuration](https://documentation.red-gate.com/fd/flyway-postgresql-transactional-lock-setting-277579114.html)
