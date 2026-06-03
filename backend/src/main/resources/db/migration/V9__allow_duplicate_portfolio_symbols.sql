alter table portfolio_holdings add column if not exists id bigint;

create sequence if not exists portfolio_holdings_id_seq;

alter sequence portfolio_holdings_id_seq owned by portfolio_holdings.id;

update portfolio_holdings
set id = nextval('portfolio_holdings_id_seq')
where id is null;

select setval(
  'portfolio_holdings_id_seq',
  greatest((select coalesce(max(id), 0) from portfolio_holdings), 1),
  true
);

alter table portfolio_holdings alter column id set default nextval('portfolio_holdings_id_seq');
alter table portfolio_holdings alter column id set not null;

alter table portfolio_holdings drop constraint if exists portfolio_holdings_pkey;
alter table portfolio_holdings add primary key (id);

create index if not exists portfolio_holdings_username_symbol_idx on portfolio_holdings (username, symbol);
