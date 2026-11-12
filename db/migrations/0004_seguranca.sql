-- Segurança e integridade do sorteio.
-- Restrições novas entram como NOT VALID: valem para tudo que for gravado daqui em diante
-- sem travar o deploy se algum dado antigo fugir da regra. Depois de conferir os dados,
-- dá para rodar "alter table ... validate constraint ..." com calma.

-- 1. Limites de uso (rate limit) compartilhados entre todas as instâncias do servidor.
--    A chave é um HMAC (não guardamos IP nem e-mail em texto).
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null
);
create index if not exists rate_limits_expires_idx on rate_limits(expires_at);

-- 2. Ninguém tira a si mesmo, nem no banco.
alter table assignments add constraint assignments_not_self check (giver_id <> receiver_id) not valid;

-- 3. Pares e regras só ligam pessoas do mesmo grupo.
alter table participants add constraint participants_id_group_uniq unique (id, group_id);
alter table assignments
  add constraint assignments_giver_same_group foreign key (giver_id, group_id)
    references participants(id, group_id) on delete cascade not valid,
  add constraint assignments_receiver_same_group foreign key (receiver_id, group_id)
    references participants(id, group_id) on delete cascade not valid;
alter table exclusions
  add constraint exclusions_a_same_group foreign key (participant_a, group_id)
    references participants(id, group_id) on delete cascade not valid,
  add constraint exclusions_b_same_group foreign key (participant_b, group_id)
    references participants(id, group_id) on delete cascade not valid;

-- 4. Limites de tamanho que antes só existiam no servidor.
alter table wishes add constraint wishes_link_len check (link is null or char_length(link) <= 500) not valid;
alter table participants add constraint participants_phone_len check (phone is null or char_length(phone) <= 20) not valid;

-- 5. Aparelho que abriu o resultado primeiro (hash de um cookie aleatório), para avisar
--    o participante se o papelzinho dele foi aberto em outro aparelho.
alter table assignments add column if not exists seen_device_hash text;

-- 6. Depois do sorteio, a lista de quem participa fica congelada no banco.
--    Mesmo que duas requisições cheguem juntas, ninguém entra, sai ou desiste
--    de um grupo sorteado (isso apagaria um par e deixaria alguém sem amigo secreto).
--    Para mudar, o organizador desfaz o sorteio (status volta a 'open').
create or replace function participants_guard_drawn() returns trigger language plpgsql as $$
declare
  st text;
begin
  if tg_op = 'DELETE' then
    select status into st from groups where id = old.group_id;
    -- st nulo: o próprio grupo está sendo apagado (cascade), então pode.
    if st = 'drawn' and exists (select 1 from assignments a where a.giver_id = old.id or a.receiver_id = old.id) then
      raise exception 'grupo já sorteado: desfaça o sorteio antes de remover participantes' using errcode = 'P0001';
    end if;
    return old;
  end if;

  select status into st from groups where id = new.group_id;
  if tg_op = 'INSERT' then
    if st = 'drawn' then
      raise exception 'grupo já sorteado: desfaça o sorteio antes de adicionar participantes' using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.group_id <> old.group_id then
      raise exception 'participante não muda de grupo' using errcode = 'P0001';
    end if;
    if st = 'drawn' and new.status = 'declined' and old.status <> 'declined'
       and exists (select 1 from assignments a where a.giver_id = old.id) then
      raise exception 'grupo já sorteado: não dá para desistir depois do sorteio' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists participants_guard_drawn on participants;
create trigger participants_guard_drawn
  before insert or update or delete on participants
  for each row execute function participants_guard_drawn();
