-- Amigo Secreto: esquema inicial (Postgres 14+, funciona local e no Neon)

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Links mágicos de login (guardamos só o hash do token)
create table login_tokens (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references users(id) on delete cascade,
  event_date date,
  location text check (char_length(location) <= 120),
  min_value numeric(10,2) check (min_value >= 0),
  max_value numeric(10,2) check (max_value >= 0),
  status text not null default 'open' check (status in ('open', 'drawn')),
  invite_code text not null unique,
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  phone text,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index participants_user_idx on participants(user_id);

-- Pares que não podem se tirar (vale nos dois sentidos)
create table exclusions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  participant_a uuid not null references participants(id) on delete cascade,
  participant_b uuid not null references participants(id) on delete cascade,
  check (participant_a <> participant_b)
);
create index exclusions_group_idx on exclusions(group_id);

-- Resultado do sorteio: quem (giver) tirou quem (receiver)
create table assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  giver_id uuid not null references participants(id) on delete cascade,
  receiver_id uuid not null references participants(id) on delete cascade,
  seen_at timestamptz,
  unique (group_id, giver_id),
  unique (group_id, receiver_id)
);

create table wishes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  link text check (link is null or link ~* '^https?://'),
  created_at timestamptz not null default now()
);
create index wishes_participant_idx on wishes(participant_id);
