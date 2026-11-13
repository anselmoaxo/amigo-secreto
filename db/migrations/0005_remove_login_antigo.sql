-- Remove o login por e-mail antigo (substituído pelos links individuais no PR #3).
-- Nada no código usa mais estas tabelas nem as colunas que apontavam para elas.
-- Apagar a coluna também apaga as chaves estrangeiras e a restrição unique (group_id, user_id).
alter table groups drop column if exists owner_id;
alter table participants drop column if exists user_id;
drop table if exists sessions;
drop table if exists login_tokens;
drop table if exists users;
