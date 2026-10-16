create table app_notification_preferences (
  username varchar(128) primary key references users(username) on delete cascade,
  dca boolean not null default false,
  briefing boolean not null default false,
  return_reminder boolean not null default false
);
create table web_push_subscriptions (
  id varchar(64) primary key,
  username varchar(128) not null references users(username) on delete cascade,
  endpoint text not null,
  public_key text not null,
  auth_secret text not null,
  updated_at timestamptz not null default now()
);
create index web_push_subscriptions_user_idx on web_push_subscriptions(username);
create table app_notifications (
  id bigserial primary key,
  username varchar(128) not null references users(username) on delete cascade,
  event_key text not null unique,
  kind varchar(16) not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index app_notifications_user_idx on app_notifications(username, id desc);
create table web_push_deliveries (
  notification_id bigint not null references app_notifications(id) on delete cascade,
  subscription_id varchar(64) not null references web_push_subscriptions(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  finished boolean not null default false,
  accepted_at timestamptz,
  primary key (notification_id, subscription_id)
);
create index web_push_deliveries_due_idx on web_push_deliveries(next_attempt_at) where not finished;
create table notification_message_snapshots (
  event_key text primary key,
  username varchar(128) not null references users(username) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
