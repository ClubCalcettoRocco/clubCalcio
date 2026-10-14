-- Avvisa i giocatori quando l'amministratore aggiorna le squadre di una partita.
-- Eseguire dopo notifications.sql e notification-messages-and-cancellations.sql.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'match_created',
    'match_invited',
    'match_not_invited',
    'match_teams_updated',
    'result_entered',
    'voting_open',
    'match_cancelled',
    'match_reminder_24h',
    'match_reminder_3h'
  ));

create or replace function public.notify_players_match_teams_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Il trigger è differito: la funzione di salvataggio ha già sostituito
  -- tutte le righe match_players prima di comporre i messaggi.
  if old.status = 'scheduled' and new.status = 'scheduled' then
    insert into public.notifications(user_id, match_id, type, title, body)
    select
      p.user_id,
      new.id,
      'match_teams_updated',
      case
        when mp.team = 'A' then 'Formazioni aggiornate: sei in ' || coalesce(new.team_a_name, 'Squadra A') || ' ⚽'
        when mp.team = 'B' then 'Formazioni aggiornate: sei in ' || coalesce(new.team_b_name, 'Squadra B') || ' ⚽'
        else 'Formazioni aggiornate'
      end,
      case
        when mp.team is not null then
          coalesce(new.team_a_name, 'Squadra A') || ' contro ' || coalesce(new.team_b_name, 'Squadra B') ||
          ' · La formazione è stata aggiornata. Controlla i dettagli della partita.'
        else
          coalesce(new.team_a_name, 'Squadra A') || ' contro ' || coalesce(new.team_b_name, 'Squadra B') ||
          ' · Le squadre sono state aggiornate. Apri la partita per vedere la formazione.'
      end
    from public.players p
    left join public.match_players mp
      on mp.match_id = new.id
     and mp.player_id = p.id
    where p.approved = true
      and p.user_id is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_notify_teams_updated on public.matches;
create constraint trigger matches_notify_teams_updated
after update on public.matches
deferrable initially deferred
for each row
execute function public.notify_players_match_teams_updated();
