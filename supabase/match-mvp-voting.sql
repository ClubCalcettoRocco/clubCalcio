-- Nomination MVP separate dall'inserimento del risultato.
-- Eseguire una volta nel SQL Editor Supabase.
create table if not exists public.match_mvp_votes (
  match_id uuid not null,
  voter_player_id uuid not null,
  target_player_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_player_id),
  constraint match_mvp_votes_not_self check (voter_player_id <> target_player_id),
  constraint match_mvp_votes_voter_participates
    foreign key (match_id, voter_player_id)
    references public.match_players(match_id, player_id) on delete cascade,
  constraint match_mvp_votes_target_participates
    foreign key (match_id, target_player_id)
    references public.match_players(match_id, player_id) on delete cascade
);

create index if not exists match_mvp_votes_target_idx
  on public.match_mvp_votes(match_id, target_player_id);

alter table public.match_mvp_votes enable row level security;
revoke all on public.match_mvp_votes from anon, authenticated;

create or replace function public.refresh_match_mvp(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid;
  v_count integer := 0;
  v_tied integer := 0;
  v_winner uuid := null;
begin
  if not exists (select 1 from public.matches where id = p_match_id and status = 'played') then
    update public.matches set mvp_player_id = null
    where id = p_match_id and mvp_player_id is not null;
    return;
  end if;

  -- Preserve old manually assigned awards until a match receives MVP ballots.
  if not exists (select 1 from public.match_mvp_votes where match_id = p_match_id) then
    return;
  end if;

  select target_player_id, count(*)::integer
    into v_candidate, v_count
  from public.match_mvp_votes
  where match_id = p_match_id
  group by target_player_id
  order by count(*) desc, target_player_id
  limit 1;

  if v_count >= 2 then
    select count(*)::integer into v_tied
    from (
      select target_player_id
      from public.match_mvp_votes
      where match_id = p_match_id
      group by target_player_id
      having count(*) = v_count
    ) leaders;
    if v_tied = 1 then v_winner := v_candidate; end if;
  end if;

  update public.matches
  set mvp_player_id = v_winner
  where id = p_match_id
    and mvp_player_id is distinct from v_winner;
end;
$$;

create or replace function public.sync_match_mvp_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_match_mvp(old.match_id);
    return old;
  end if;
  perform public.refresh_match_mvp(new.match_id);
  if tg_op = 'UPDATE' and old.match_id is distinct from new.match_id then
    perform public.refresh_match_mvp(old.match_id);
  end if;
  return new;
end;
$$;

drop trigger if exists match_mvp_votes_sync on public.match_mvp_votes;
create trigger match_mvp_votes_sync
after insert or update or delete on public.match_mvp_votes
for each row execute function public.sync_match_mvp_vote();

create or replace function public.sync_match_mvp_after_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_match_mvp(new.id);
  return new;
end;
$$;

drop trigger if exists matches_sync_mvp_after_result on public.matches;
create trigger matches_sync_mvp_after_result
after update of status, score_a, score_b on public.matches
for each row execute function public.sync_match_mvp_after_result();

create or replace function public.get_match_mvp_vote_data(p_match_id uuid)
returns table(target_player_id uuid, vote_count bigint, my_vote uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.current_player_id();
begin
  if not public.current_is_approved() or v_player_id is null then
    raise exception 'Profilo non autorizzato';
  end if;
  if not exists (
    select 1 from public.match_players
    where match_id = p_match_id and player_id = v_player_id
  ) then
    raise exception 'Devi aver partecipato alla partita per consultare le nomination MVP';
  end if;

  return query
  select mp.player_id,
         count(v.voter_player_id)::bigint,
         (select mine.target_player_id
          from public.match_mvp_votes mine
          where mine.match_id = p_match_id and mine.voter_player_id = v_player_id
          limit 1)
  from public.match_players mp
  left join public.match_mvp_votes v
    on v.match_id = mp.match_id and v.target_player_id = mp.player_id
  where mp.match_id = p_match_id
  group by mp.player_id
  order by count(v.voter_player_id) desc, mp.player_id;
end;
$$;

create or replace function public.save_my_match_mvp_vote(
  p_match_id uuid,
  p_target_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.current_player_id();
begin
  if not public.current_is_approved() or v_player_id is null then
    raise exception 'Profilo non autorizzato';
  end if;
  if not exists (
    select 1 from public.matches
    where id = p_match_id
      and status = 'played'
      and now() < kickoff + interval '24 hours'
  ) then
    raise exception 'Le votazioni MVP sono chiuse o la partita non è ancora registrata';
  end if;
  if not exists (
    select 1 from public.match_players
    where match_id = p_match_id and player_id = v_player_id
  ) then
    raise exception 'Solo chi ha partecipato può votare l’MVP';
  end if;
  if p_target_player_id = v_player_id or not exists (
    select 1 from public.match_players
    where match_id = p_match_id and player_id = p_target_player_id
  ) then
    raise exception 'Scegli un altro partecipante alla partita';
  end if;

  insert into public.match_mvp_votes(match_id, voter_player_id, target_player_id)
  values (p_match_id, v_player_id, p_target_player_id)
  on conflict (match_id, voter_player_id)
  do update set target_player_id = excluded.target_player_id;
end;
$$;

revoke all on function public.refresh_match_mvp(uuid) from public, anon, authenticated;
revoke all on function public.sync_match_mvp_vote() from public, anon, authenticated;
revoke all on function public.sync_match_mvp_after_result() from public, anon, authenticated;
revoke all on function public.get_match_mvp_vote_data(uuid) from public, anon, authenticated;
revoke all on function public.save_my_match_mvp_vote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_match_mvp_vote_data(uuid) to authenticated;
grant execute on function public.save_my_match_mvp_vote(uuid, uuid) to authenticated;
