alter table users
  add column if not exists telegram_alert_days varchar(64) not null default 'MON,TUE,WED,THU,FRI,SAT,SUN';

alter table users
  add column if not exists telegram_dca_days varchar(64) not null default 'WED,FRI';
