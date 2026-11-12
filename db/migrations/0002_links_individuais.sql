-- Links individuais: ninguém precisa criar conta.
-- O organizador entra por um link de administração e cada participante pelo próprio link.
-- Guardamos o hash do token (para achar a pessoa) e o token cifrado com APP_SECRET
-- (para o servidor reenviar o mesmo link por e-mail/WhatsApp sem mostrá-lo a ninguém).

alter table groups alter column owner_id drop not null;
alter table groups
  add column occasion text not null default 'natal'
    check (occasion in ('natal', 'fim-de-ano', 'empresa', 'familia', 'amigos', 'aniversario', 'pascoa', 'outro')),
  add column event_time time,
  add column description text check (char_length(description) <= 500),
  add column organizer_name text check (char_length(organizer_name) <= 60),
  add column organizer_email text check (char_length(organizer_email) <= 200),
  add column rsvp_deadline date,
  add column wishlist_enabled boolean not null default true,
  add column wishlist_until date,
  add column allow_changes boolean not null default true,
  add column organizer_can_see_pairs boolean not null default false,
  add column admin_token_hash text unique,
  add column admin_token_enc text,
  add column updated_at timestamptz not null default now();

-- Grupos antigos: nome e e-mail do organizador vêm da conta dele (para recuperar o link por e-mail).
update groups g set
  organizer_email = u.email,
  organizer_name = (select p.display_name from participants p where p.group_id = g.id and p.user_id = g.owner_id limit 1)
from users u where u.id = g.owner_id;

alter table participants alter column user_id drop not null;
alter table participants drop constraint if exists participants_group_id_user_id_key;
create unique index participants_group_user_uniq on participants(group_id, user_id) where user_id is not null;

alter table participants
  add column email text check (char_length(email) <= 200),
  add column status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  add column responded_at timestamptz,
  add column team text check (char_length(team) <= 40),
  add column preferences text check (char_length(preferences) <= 500),
  add column is_organizer boolean not null default false,
  add column access_token_hash text unique,
  add column access_token_enc text,
  add column invite_sent_at timestamptz;

-- Quem já estava no grupo entrou por conta própria: conta como confirmado.
update participants p set
  email = u.email,
  status = 'confirmed',
  responded_at = p.joined_at,
  is_organizer = (p.user_id = g.owner_id)
from users u, groups g
where u.id = p.user_id and g.id = p.group_id;

-- "A não pode tirar B". one_way = false vale nos dois sentidos.
alter table exclusions add column one_way boolean not null default false;
delete from exclusions e using exclusions f
where e.group_id = f.group_id and e.participant_a = f.participant_a and e.participant_b = f.participant_b and e.id > f.id;
create unique index exclusions_pair_uniq on exclusions(group_id, participant_a, participant_b);

alter table assignments add column created_at timestamptz not null default now();
create index assignments_receiver_idx on assignments(receiver_id);
