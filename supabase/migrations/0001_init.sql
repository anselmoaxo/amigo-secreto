-- Amigo Secreto: esquema inicial do MVP
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).

create extension if not exists pgcrypto;

-- Grupos ---------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_date date,
  location text check (char_length(location) <= 120),
  min_value numeric(10,2) check (min_value >= 0),
  max_value numeric(10,2) check (max_value >= 0),
  status text not null default 'open' check (status in ('open', 'drawn')),
  plan text not null default 'free' check (plan in ('free', 'paid')),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);

-- Participantes --------------------------------------------------------
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  email text,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index participants_user_idx on public.participants(user_id);

-- Pares que não podem se tirar (vale nos dois sentidos) -----------------
create table public.exclusions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  participant_a uuid not null references public.participants(id) on delete cascade,
  participant_b uuid not null references public.participants(id) on delete cascade,
  check (participant_a <> participant_b)
);
create index exclusions_group_idx on public.exclusions(group_id);

-- Resultado do sorteio: quem (giver) tirou quem (receiver) ---------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  giver_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  seen_at timestamptz,
  unique (group_id, giver_id),
  unique (group_id, receiver_id)
);

-- Lista de desejos -----------------------------------------------------
create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  link text check (link is null or link ~* '^https?://'),
  created_at timestamptz not null default now()
);
create index wishes_participant_idx on public.wishes(participant_id);

-- Funções auxiliares ---------------------------------------------------
create or replace function public.is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from participants where group_id = p_group and user_id = auth.uid());
$$;

create or replace function public.is_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = p_group and owner_id = auth.uid());
$$;

-- Cria o grupo e já coloca o organizador como participante
create or replace function public.create_group(
  p_name text, p_display_name text, p_event_date date, p_location text,
  p_min numeric, p_max numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  insert into groups (name, owner_id, event_date, location, min_value, max_value)
  values (p_name, auth.uid(), p_event_date, nullif(p_location, ''), p_min, p_max)
  returning id into v_id;
  insert into participants (group_id, user_id, display_name, email)
  values (v_id, auth.uid(), p_display_name, auth.jwt() ->> 'email');
  return v_id;
end $$;

-- Dados públicos do convite (antes de entrar no grupo)
create or replace function public.get_invite(p_code text)
returns table (id uuid, name text, event_date date, location text,
               min_value numeric, max_value numeric, status text, members bigint)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.event_date, g.location, g.min_value, g.max_value, g.status,
         (select count(*) from participants p where p.group_id = g.id)
  from groups g where g.invite_code = p_code;
$$;

-- Entrar no grupo pelo código do convite
create or replace function public.join_group(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  select * into v_group from groups where invite_code = p_code;
  if not found then raise exception 'Convite inválido'; end if;
  if exists (select 1 from participants where group_id = v_group.id and user_id = auth.uid()) then
    return v_group.id;
  end if;
  if v_group.status <> 'open' then raise exception 'O sorteio deste grupo já foi feito'; end if;
  insert into participants (group_id, user_id, display_name, email)
  values (v_group.id, auth.uid(), p_display_name, auth.jwt() ->> 'email');
  return v_group.id;
end $$;

-- Marca que o participante viu quem tirou
create or replace function public.mark_seen(p_group uuid)
returns void language sql security definer set search_path = public as $$
  update assignments a set seen_at = coalesce(a.seen_at, now())
  from participants p
  where a.giver_id = p.id and p.user_id = auth.uid() and a.group_id = p_group;
$$;

-- Segurança (RLS) ------------------------------------------------------
alter table public.groups enable row level security;
alter table public.participants enable row level security;
alter table public.exclusions enable row level security;
alter table public.assignments enable row level security;
alter table public.wishes enable row level security;

create policy "membros veem o grupo" on public.groups
  for select using (owner_id = auth.uid() or public.is_member(id));
create policy "organizador edita o grupo" on public.groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "organizador apaga o grupo" on public.groups
  for delete using (owner_id = auth.uid());

create policy "membros veem participantes" on public.participants
  for select using (public.is_member(group_id));
create policy "sair ou remover antes do sorteio" on public.participants
  for delete using (
    (user_id = auth.uid() or public.is_owner(group_id))
    and exists (select 1 from groups g where g.id = group_id and g.status = 'open')
  );

create policy "organizador vê exclusões" on public.exclusions
  for select using (public.is_owner(group_id));
create policy "organizador cria exclusões" on public.exclusions
  for insert with check (public.is_owner(group_id));
create policy "organizador apaga exclusões" on public.exclusions
  for delete using (public.is_owner(group_id));

-- Cada um só vê o próprio par. Nem o organizador vê os outros.
-- O sorteio é gravado pelo servidor com a chave de serviço.
create policy "só vejo quem eu tirei" on public.assignments
  for select using (
    exists (select 1 from participants p where p.id = giver_id and p.user_id = auth.uid())
  );

create policy "membros veem desejos" on public.wishes
  for select using (
    exists (select 1 from participants p where p.id = participant_id and public.is_member(p.group_id))
  );
create policy "dono cria desejo" on public.wishes
  for insert with check (
    exists (select 1 from participants p where p.id = participant_id and p.user_id = auth.uid())
  );
create policy "dono apaga desejo" on public.wishes
  for delete using (
    exists (select 1 from participants p where p.id = participant_id and p.user_id = auth.uid())
  );

-- Só usuários logados chamam as funções que gravam dados
revoke execute on function public.create_group(text, text, date, text, numeric, numeric) from public, anon;
revoke execute on function public.join_group(text, text) from public, anon;
revoke execute on function public.mark_seen(uuid) from public, anon;
grant execute on function public.create_group(text, text, date, text, numeric, numeric) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.mark_seen(uuid) to authenticated;
