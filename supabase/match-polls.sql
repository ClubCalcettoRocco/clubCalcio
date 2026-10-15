-- Sondaggi disponibilita: i giocatori approvati possono crearli e votare.
-- La partita viene creata automaticamente al raggiungimento della capienza.
-- Eseguire dopo schema.sql e notifications.sql (oltre alle migrazioni notifiche gia' in uso).

create table if not exists public.match_polls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.players(id) on delete set null,
  type public.match_type not null,
  kickoff timestamptz not null,
  location text not null check (length(trim(location)) > 0),
  status text not null default 'open' check (status in ('open', 'converted', 'cancelled')),
  match_id uuid unique references public.matches(id) on delete set null,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_polls_status_kickoff_idx
  on public.match_polls(status, kickoff asc);

create table if not exists public.match_poll_votes (
  poll_id uuid not null references public.match_polls(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  present boolean not null,
  updated_at timestamptz not null default now(),
  primary key (poll_id, player_id)
);

alter table public.match_polls enable row level security;
alter table public.match_poll_votes enable row level security;

drop policy if exists match_polls_read_approved on public.match_polls;
create policy match_polls_read_approved on public.match_polls
  for select to authenticated using (public.current_is_approved());

revoke all on public.match_polls, public.match_poll_votes from anon, authenticated;
grant select on public.match_polls to authenticated;

alter table public.notifications add column if not exists poll_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_players'
  ) then
    alter publication supabase_realtime add table public.match_players;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_poll_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_poll_id_fkey
      foreign key (poll_id) references public.match_polls(id) on delete set null;
  end if;
end;
$$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'match_created', 'match_invited', 'match_not_invited', 'match_teams_updated',
  'result_entered', 'voting_open', 'match_cancelled',
  'match_reminder_24h', 'match_reminder_3h',
  'match_poll_open', 'match_poll_one_left', 'match_poll_slot_open', 'match_poll_cancelled'
));

create or replace function public.create_match_poll(
  p_type public.match_type,
  p_kickoff timestamptz,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.current_player_id();
  v_poll_id uuid;
begin
  if not public.current_is_approved() or v_player_id is null then
    raise exception 'Solo i giocatori approvati possono creare sondaggi';
  end if;
  if p_kickoff is null or p_kickoff <= now() then
    raise exception 'Scegli una data e un’ora future';
  end if;
  if p_location is null or length(trim(p_location)) < 2 then
    raise exception 'Inserisci il luogo della partita';
  end if;

  insert into public.match_polls(created_by, type, kickoff, location)
  values (v_player_id, p_type, p_kickoff, trim(p_location))
  returning id into v_poll_id;

  insert into public.notifications(user_id, poll_id, type, title, body)
  select p.user_id, v_poll_id, 'match_poll_open', 'Nuovo sondaggio partita ⚽',
         'Quando e dove: ' || trim(p_location) || '. Apri il sondaggio e indica se ci sei.'
  from public.players p
  where p.approved = true and p.user_id is not null and p.id <> v_player_id;

  return v_poll_id;
end;
$$;

drop function if exists public.get_match_polls();

create function public.get_match_polls()
returns table (
  id uuid,
  match_type public.match_type,
  kickoff timestamptz,
  location text,
  status text,
  match_id uuid,
  created_at timestamptz,
  creator_name text,
  can_delete boolean,
  yes_count integer,
  no_count integer,
  capacity integer,
  my_vote boolean,
  yes_voters jsonb,
  no_voters jsonb,
  pending_voters jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.current_player_id();
begin
  if not public.current_is_approved() or v_player_id is null then
    raise exception 'Profilo non autorizzato';
  end if;

  return query
  select poll.id,
         poll.type,
         poll.kickoff,
         poll.location,
         poll.status,
         poll.match_id,
         poll.created_at,
         coalesce(nullif(trim(concat_ws(' ', creator.first_name, creator.last_name)), ''), 'Giocatore') as creator_name,
         (poll.created_by = v_player_id or public.current_is_admin()) as can_delete,
         count(vote.player_id) filter (where vote.present)::integer as yes_count,
         count(vote.player_id) filter (where not vote.present)::integer as no_count,
         case poll.type when 'calcetto5' then 10 when 'calciotto8' then 16 when 'calcio11' then 22 end as capacity,
         mine.present as my_vote,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', yes_player.id,
             'name', coalesce(nullif(trim(concat_ws(' ', yes_player.first_name, yes_player.last_name)), ''), 'Giocatore'),
             'photo_url', yes_player.photo_url
           ) order by lower(concat_ws(' ', yes_player.first_name, yes_player.last_name)))
           from public.match_poll_votes yes_vote
           join public.players yes_player on yes_player.id = yes_vote.player_id
           where yes_vote.poll_id = poll.id and yes_vote.present
         ), '[]'::jsonb) as yes_voters,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', no_player.id,
             'name', coalesce(nullif(trim(concat_ws(' ', no_player.first_name, no_player.last_name)), ''), 'Giocatore'),
             'photo_url', no_player.photo_url
           ) order by lower(concat_ws(' ', no_player.first_name, no_player.last_name)))
           from public.match_poll_votes no_vote
           join public.players no_player on no_player.id = no_vote.player_id
           where no_vote.poll_id = poll.id and not no_vote.present
         ), '[]'::jsonb) as no_voters,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', pending_player.id,
             'name', coalesce(nullif(trim(concat_ws(' ', pending_player.first_name, pending_player.last_name)), ''), 'Giocatore'),
             'photo_url', pending_player.photo_url
           ) order by lower(concat_ws(' ', pending_player.first_name, pending_player.last_name)))
           from public.players pending_player
           where pending_player.approved = true
             and not exists (
               select 1 from public.match_poll_votes pending_vote
               where pending_vote.poll_id = poll.id and pending_vote.player_id = pending_player.id
             )
         ), '[]'::jsonb) as pending_voters
  from public.match_polls poll
  left join public.players creator on creator.id = poll.created_by
  left join public.match_poll_votes vote on vote.poll_id = poll.id
  left join public.match_poll_votes mine on mine.poll_id = poll.id and mine.player_id = v_player_id
  where poll.status = 'open'
     or (poll.status = 'converted' and poll.kickoff > now() - interval '7 days')
  group by poll.id, poll.created_by, creator.first_name, creator.last_name, mine.present
  order by (poll.status = 'open') desc, poll.kickoff asc, poll.created_at desc;
end;
$$;

create or replace function public.delete_match_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.current_player_id();
  v_poll public.match_polls%rowtype;
begin
  if not public.current_is_approved() or v_player_id is null then
    raise exception 'Profilo non autorizzato';
  end if;

  select * into v_poll
  from public.match_polls
  where id = p_poll_id
  for update;
  if not found or v_poll.status = 'cancelled' then
    raise exception 'Sondaggio non trovato';
  end if;
  if v_poll.created_by is distinct from v_player_id and not public.current_is_admin() then
    raise exception 'Può eliminare il sondaggio solo chi lo ha creato o un amministratore';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'La partita è già stata creata: non puoi eliminare il sondaggio';
  end if;

  update public.match_polls
    set status = 'cancelled', updated_at = now()
  where id = p_poll_id;

  insert into public.notifications(user_id, poll_id, type, title, body)
  select player.user_id,
         p_poll_id,
         'match_poll_cancelled',
         'Sondaggio annullato 🛑',
         'Il sondaggio per ' || v_poll.location || ' (' || to_char(v_poll.kickoff at time zone 'Europe/Rome', 'DD/MM alle HH24:MI') || ') è stato eliminato.'
  from public.players player
  where player.approved = true and player.user_id is not null;
end;
$$;

create or replace function public.cast_match_poll_vote(p_poll_id uuid, p_present boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.current_player_id();
  v_poll public.match_polls%rowtype;
  v_old_vote boolean;
  v_yes_before integer;
  v_yes_after integer;
  v_capacity integer;
  v_team_a_count integer;
  v_team_b_count integer;
  v_match_id uuid;
begin
  if not public.current_is_approved() or v_player_id is null then
    raise exception 'Solo i giocatori approvati possono votare';
  end if;
  if p_present is null then raise exception 'Seleziona Ci sono oppure Non ci sono'; end if;

  select * into v_poll
  from public.match_polls
  where id = p_poll_id
  for update;
  if not found or v_poll.status = 'cancelled' then
    raise exception 'Questo sondaggio non è più disponibile';
  end if;
  if v_poll.kickoff <= now() then raise exception 'Il sondaggio è chiuso perché la partita è iniziata'; end if;

  v_capacity := case v_poll.type when 'calcetto5' then 10 when 'calciotto8' then 16 when 'calcio11' then 22 end;
  select present into v_old_vote from public.match_poll_votes
    where poll_id = p_poll_id and player_id = v_player_id;
  select count(*)::integer into v_yes_before from public.match_poll_votes
    where poll_id = p_poll_id and present;

  if v_poll.status = 'converted' and p_present and v_old_vote is distinct from true then
    select count(*) filter (where team = 'A')::integer,
           count(*) filter (where team = 'B')::integer
      into v_team_a_count, v_team_b_count
    from public.match_players where match_id = v_poll.match_id;
    if coalesce(v_team_a_count, 0) + coalesce(v_team_b_count, 0) >= v_capacity then
      raise exception 'I posti sono già tutti occupati';
    end if;
  end if;

  insert into public.match_poll_votes(poll_id, player_id, present)
  values (p_poll_id, v_player_id, p_present)
  on conflict (poll_id, player_id)
  do update set present = excluded.present, updated_at = now();

  select count(*)::integer into v_yes_after from public.match_poll_votes
    where poll_id = p_poll_id and present;

  if v_poll.status = 'open' and p_present and v_yes_after = v_capacity - 1
     and v_poll.reminder_sent_at is null then
    insert into public.notifications(user_id, poll_id, type, title, body)
    select p.user_id, p_poll_id, 'match_poll_one_left', 'Ne manca uno! 👀',
           'Siamo a un solo giocatore dal creare la partita. Hai già deciso se ci sei?'
    from public.players p
    where p.approved = true and p.user_id is not null and p.id <> v_player_id
      and not exists (
        select 1 from public.match_poll_votes vote
        where vote.poll_id = p_poll_id and vote.player_id = p.id
      );
    update public.match_polls set reminder_sent_at = now() where id = p_poll_id;
  end if;

  if v_old_vote is true and p_present = false then
    delete from public.match_players
    where match_id = v_poll.match_id and player_id = v_player_id
      and exists (
        select 1 from public.matches match_row
        where match_row.id = v_poll.match_id and match_row.status = 'scheduled'
          and match_row.kickoff > now()
      );

    insert into public.notifications(user_id, poll_id, match_id, type, title, body)
    select p.user_id, p_poll_id, v_poll.match_id, 'match_poll_slot_open', 'Si è liberato un posto ⚽',
           'Un giocatore non può più esserci. Apri il sondaggio: se ti sei liberato, puoi ancora unirti.'
    from public.players p
    where p.approved = true and p.user_id is not null and p.id <> v_player_id
      and not exists (
        select 1 from public.match_poll_votes vote
        where vote.poll_id = p_poll_id and vote.present
      );
  end if;

  if v_poll.status = 'open' and v_yes_after >= v_capacity then
    insert into public.matches(type, kickoff, location, team_a_name, team_b_name, notes, created_by)
    values (
      v_poll.type,
      v_poll.kickoff,
      v_poll.location,
      'Squadra A',
      'Squadra B',
      'Partita creata automaticamente dal sondaggio.',
      coalesce(v_poll.created_by, v_player_id)
    ) returning id into v_match_id;

    with participants as (
      select vote.player_id,
             row_number() over (order by random(), vote.player_id) as roster_position
      from public.match_poll_votes vote
      where vote.poll_id = p_poll_id and vote.present
    )
    insert into public.match_players(match_id, player_id, team)
    select v_match_id, participant.player_id,
           case when participant.roster_position <= v_capacity / 2
             then 'A'::public.team_side else 'B'::public.team_side end
    from participants participant;

    update public.match_polls
      set status = 'converted', match_id = v_match_id, updated_at = now()
    where id = p_poll_id;
  elsif v_poll.status = 'converted' and p_present and v_old_vote is distinct from true then
    select count(*) filter (where team = 'A')::integer,
           count(*) filter (where team = 'B')::integer
      into v_team_a_count, v_team_b_count
    from public.match_players where match_id = v_poll.match_id;
    insert into public.match_players(match_id, player_id, team)
    values (
      v_poll.match_id,
      v_player_id,
      case when coalesce(v_team_a_count, 0) <= coalesce(v_team_b_count, 0)
        then 'A'::public.team_side else 'B'::public.team_side end
    );
    update public.match_polls set updated_at = now() where id = p_poll_id;
  else
    update public.match_polls set updated_at = now() where id = p_poll_id;
  end if;

  return coalesce(v_match_id, v_poll.match_id);
end;
$$;

revoke all on function public.create_match_poll(public.match_type, timestamptz, text) from public, anon, authenticated;
revoke all on function public.get_match_polls() from public, anon, authenticated;
revoke all on function public.cast_match_poll_vote(uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_match_poll(uuid) from public, anon, authenticated;
grant execute on function public.create_match_poll(public.match_type, timestamptz, text) to authenticated;
grant execute on function public.get_match_polls() to authenticated;
grant execute on function public.cast_match_poll_vote(uuid, boolean) to authenticated;
grant execute on function public.delete_match_poll(uuid) to authenticated;

-- La riga del sondaggio viene aggiornata a ogni voto, quindi basta pubblicare questa tabella
-- per aggiornare in tempo reale conteggi e stato sugli altri dispositivi.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_polls'
  ) then
    alter publication supabase_realtime add table public.match_polls;
  end if;
exception when undefined_object then
  null;
end;
$$;
