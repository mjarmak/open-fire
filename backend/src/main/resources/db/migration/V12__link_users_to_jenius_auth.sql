alter table users add column if not exists oidc_subject varchar(128);

create unique index if not exists users_oidc_subject_idx
on users (oidc_subject)
where oidc_subject is not null;
