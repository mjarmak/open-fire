create table if not exists users (
  username varchar(128) primary key,
  password_hash varchar(128) not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_username_lower_idx on users (lower(username));

insert into users (username, password_hash, enabled, updated_at)
values ('${defaultUsername}', '${defaultPasswordHash}', true, now())
on conflict (username) do nothing;

create table if not exists portfolio_holdings (
  username varchar(128),
  symbol varchar(32) not null,
  company_name text not null,
  quantity numeric(24, 8) not null,
  average_cost numeric(24, 8) not null,
  updated_at timestamptz not null default now()
);

alter table portfolio_holdings add column if not exists username varchar(128);
alter table portfolio_holdings add column if not exists symbol varchar(32);
alter table portfolio_holdings add column if not exists company_name text;
alter table portfolio_holdings add column if not exists quantity numeric(24, 8);
alter table portfolio_holdings add column if not exists average_cost numeric(24, 8);
alter table portfolio_holdings add column if not exists updated_at timestamptz not null default now();

update portfolio_holdings
set username = '${defaultUsername}'
where username is null;

alter table portfolio_holdings alter column username set not null;
alter table portfolio_holdings alter column symbol set not null;
alter table portfolio_holdings alter column company_name set not null;
alter table portfolio_holdings alter column quantity set not null;
alter table portfolio_holdings alter column average_cost set not null;

alter table portfolio_holdings drop constraint if exists portfolio_holdings_pkey;
alter table portfolio_holdings add primary key (username, symbol);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'portfolio_holdings_username_fkey'
  ) then
    alter table portfolio_holdings
    add constraint portfolio_holdings_username_fkey
    foreign key (username)
    references users(username)
    on delete cascade;
  end if;
end
$$;
