-- Keep existing primary/unique indexes; these cover the remaining runtime query paths.
create index concurrently if not exists portfolio_holdings_user_order_idx
  on portfolio_holdings (username, watch_only, symbol, id);
create index concurrently if not exists portfolio_holdings_alert_cooldown_idx
  on portfolio_holdings (username, last_alert_sent_at) where last_alert_sent_at is not null;

create index concurrently if not exists users_telegram_recipients_idx
  on users (username) where telegram_chat_id is not null and telegram_chat_id <> '';
create index concurrently if not exists users_telegram_dca_recipients_idx
  on users (username) where telegram_chat_id is not null and telegram_chat_id <> ''
    and coalesce(telegram_dca_enabled, false) = true;
create index concurrently if not exists users_email_dca_days_idx
  on users using gin (string_to_array(telegram_dca_days, ','))
  where enabled = true and email_verified = true and email_address <> '' and email_dca_enabled = true;
create index concurrently if not exists users_email_return_due_idx
  on users (last_app_visit, username)
  where enabled = true and email_verified = true and email_address <> '' and email_return_enabled = true;

create index concurrently if not exists app_notification_preferences_dca_idx
  on app_notification_preferences (username) where dca = true;
create index concurrently if not exists app_notification_preferences_briefing_idx
  on app_notification_preferences (username) where briefing = true;
create index concurrently if not exists app_notification_preferences_return_idx
  on app_notification_preferences (username) where return_reminder = true;

-- Timestamp ranges used by retention jobs.
create index concurrently if not exists app_notifications_created_at_idx on app_notifications (created_at);
create index concurrently if not exists web_push_subscriptions_updated_at_idx on web_push_subscriptions (updated_at);
create index concurrently if not exists notification_message_snapshots_created_at_idx on notification_message_snapshots (created_at);

-- Referencing-side foreign keys also need indexes for joins and cascading deletes.
create index concurrently if not exists notification_message_snapshots_username_idx on notification_message_snapshots (username);
create index concurrently if not exists web_push_deliveries_subscription_idx on web_push_deliveries (subscription_id);
create index concurrently if not exists feedback_messages_owner_idx on feedback_messages (username);
