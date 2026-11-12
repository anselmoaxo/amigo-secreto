-- Se uma versão anterior da 0002 já rodou neste banco, devolve a restrição unique (group_id, user_id),
-- que a versão do app sem links individuais usa no "on conflict". Não faz nada se ela já existir.
drop index if exists participants_group_user_uniq;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'participants_group_id_user_id_key') then
    alter table participants add constraint participants_group_id_user_id_key unique (group_id, user_id);
  end if;
end $$;
