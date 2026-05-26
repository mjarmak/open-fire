alter table users add column if not exists investing_start_date varchar(64);
alter table users add column if not exists desired_monthly_income numeric(24, 8);
alter table users add column if not exists custom_return_rate numeric(24, 8);
alter table users add column if not exists monthly_savings numeric(24, 8);
alter table users add column if not exists other_savings numeric(24, 8);
