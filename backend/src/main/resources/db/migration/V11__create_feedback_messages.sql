create table if not exists feedback_messages (
  id bigserial primary key,
  username varchar(128) not null,
  message varchar(512) not null,
  telegram_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_created_at_idx on feedback_messages (created_at desc);
create index if not exists feedback_messages_username_idx on feedback_messages (lower(username));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_messages_username_fkey'
  ) then
    alter table feedback_messages
    add constraint feedback_messages_username_fkey
    foreign key (username)
    references users(username)
    on delete cascade;
  end if;
end
$$;
