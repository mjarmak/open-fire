alter table portfolio_holdings
add column if not exists watch_only boolean not null default false;
