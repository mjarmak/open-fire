alter table users add column email_address text;
alter table users add column email_verified boolean not null default false;
alter table users add column last_app_visit timestamptz;
alter table users add column email_dca_enabled boolean not null default false;
alter table users add column email_return_enabled boolean not null default false;
create table email_deliveries (
  event_key text primary key,
  accepted_at timestamptz not null default now()
);
