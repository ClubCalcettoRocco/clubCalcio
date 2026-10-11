-- Messaggi personalizzati per convocazioni, risultati, votazioni e annullamenti.
-- Eseguire una volta dopo notifications.sql e match-reminders.sql.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'match_created',
    'match_invited',
    'match_not_invited',
    'result_entered',
    'voting_open',
    'match_cancelled',
    'match_reminder_24h',
    'match_reminder_3h'
  ));

-- Conserva l'avviso di annullamento anche dopo l'eliminazione della partita.
alter table public.notifications
  drop constraint if exists notifications_match_id_fkey;

alter table public.notifications
  add constraint notifications_match_id_fkey
  foreign key (match_id) references public.matches(id) on delete set null;

create or replace function public.notify_registered_players_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_top_scorers text;
begin
  if tg_op = 'INSERT' then
    -- È un constraint trigger differito: a questo punto la rosa è già stata inserita.
    insert into public.notifications(user_id, match_id, type, title, body)
    select
      p.user_id,
      new.id,
      case when exists (
        select 1
        from public.match_players mp
        where mp.match_id = new.id and mp.player_id = p.id
      ) then 'match_invited' else 'match_not_invited' end,
      case when exists (
        select 1
        from public.match_players mp
        where mp.match_id = new.id and mp.player_id = p.id
      ) then 'Sei stato convocato! ⚽' else 'Questa volta niente convocazione' end,
      case when exists (
        select 1
        from public.match_players mp
        where mp.match_id = new.id and mp.player_id = p.id
      ) then
        'Ti aspettiamo per ' || coalesce(new.team_a_name, 'Squadra A') || ' contro ' || coalesce(new.team_b_name, 'Squadra B') || ' · ' || coalesce(new.location, 'luogo da definire')
      else
        'Per ' || coalesce(new.team_a_name, 'Squadra A') || ' contro ' || coalesce(new.team_b_name, 'Squadra B') || ' non sei in formazione. Alla prossima!'
      end
    from public.players p
    where p.approved = true and p.user_id is not null;

    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'played' then
    with scorer_rows as (
      select
        case
          when g.scorer_id is not null then 'player:' || g.scorer_id::text
          else 'guest:' || (to_jsonb(g)->>'guest_scorer_match_player_id')
        end as scorer_key,
        coalesce(
          nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
          nullif(trim(concat_ws(' ', to_jsonb(mp)->>'guest_first_name', to_jsonb(mp)->>'guest_last_name')), ''),
          'Ospite'
        ) as scorer_name
      from public.goals g
      left join public.players p on p.id = g.scorer_id
      left join public.match_players mp
        on mp.match_id = g.match_id
       and to_jsonb(mp)->>'id' = to_jsonb(g)->>'guest_scorer_match_player_id'
      where g.match_id = new.id
        and coalesce(g.own_goal, false) = false
        and (g.scorer_id is not null or to_jsonb(g)->>'guest_scorer_match_player_id' is not null)
    ), scorer_counts as (
      select scorer_key, scorer_name, count(*)::integer as goals
      from scorer_rows
      group by scorer_key, scorer_name
    ), leaders as (
      select scorer_name, goals
      from scorer_counts
      where goals = (select max(goals) from scorer_counts)
    )
    select string_agg(scorer_name || ' (' || goals || ' gol)', ', ' order by scorer_name)
      into v_top_scorers
      from leaders;

    v_body := coalesce(new.team_a_name, 'Squadra A') || ' ' ||
      coalesce(new.score_a::text, '0') || '–' ||
      coalesce(new.score_b::text, '0') || ' ' ||
      coalesce(new.team_b_name, 'Squadra B') ||
      ' · Capocannoniere della partita: ' || coalesce(v_top_scorers, 'nessun gol registrato');

    insert into public.notifications(user_id, match_id, type, title, body)
    select p.user_id, new.id, 'result_entered', 'Risultato e capocannoniere 📊', v_body
      from public.players p
     where p.approved = true and p.user_id is not null;

    if new.kickoff + interval '24 hours' > now() then
      insert into public.notifications(user_id, match_id, type, title, body)
      select
        p.user_id,
        new.id,
        'voting_open',
        'Giudice di giornata: tocca a te 🗳️',
        'Vota con sincerità: niente voti a caso, il VAR ti guarda 👀'
      from public.players p
      where p.approved = true and p.user_id is not null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_notify_registered_players on public.matches;
drop trigger if exists matches_notify_registered_players_updated on public.matches;

-- A fine transazione le righe di match_players sono già presenti.
create constraint trigger matches_notify_registered_players
after insert on public.matches
deferrable initially deferred
for each row
execute function public.notify_registered_players_for_match();

create trigger matches_notify_registered_players_updated
after update of status on public.matches
for each row
execute function public.notify_registered_players_for_match();

create or replace function public.notify_players_match_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, match_id, type, title, body)
  select
    p.user_id,
    old.id,
    'match_cancelled',
    'Partita annullata 🛑',
    coalesce(old.team_a_name, 'Squadra A') || ' contro ' || coalesce(old.team_b_name, 'Squadra B') ||
    ' · ' || coalesce(old.location, 'luogo da definire') ||
    ' del ' || to_char(old.kickoff at time zone 'Europe/Rome', 'DD/MM alle HH24:MI') ||
    ' è stata annullata.'
  from public.players p
  where p.approved = true and p.user_id is not null;

  return old;
end;
$$;

drop trigger if exists matches_notify_cancellation on public.matches;
create trigger matches_notify_cancellation
before delete on public.matches
for each row
execute function public.notify_players_match_cancelled();
