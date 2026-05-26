alter table users
  add column if not exists telegram_dca_enabled boolean not null default false;

alter table users
  add column if not exists dca_reminder_note text;
