-- Elimina i sondaggi quando manca un'ora all'inizio della partita.
-- Richiede pg_cron, abilitato da supabase/match-reminders.sql.

create or replace function public.reject_late_match_poll_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kickoff <= now() + interval '1 hour' then
    raise exception 'Non è possibile creare un sondaggio a meno di un’ora dalla partita';
  end if;
  return new;
end;
$$;

drop trigger if exists match_poll_creation_cutoff on public.match_polls;
create trigger match_poll_creation_cutoff
before insert on public.match_polls
for each row execute function public.reject_late_match_poll_creation();

create or replace function public.reject_late_match_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kickoff timestamptz;
  v_status text;
begin
  select kickoff, status
    into v_kickoff, v_status
  from public.match_polls
  where id = new.poll_id;

  if not found or v_status not in ('open', 'converted') then
    raise exception 'Questo sondaggio non è più disponibile';
  end if;

  if v_kickoff <= now() + interval '1 hour' then
    raise exception 'Il sondaggio si chiude un’ora prima della partita';
  end if;

  return new;
end;
$$;

drop trigger if exists match_poll_vote_cutoff on public.match_poll_votes;
create trigger match_poll_vote_cutoff
before insert or update on public.match_poll_votes
for each row execute function public.reject_late_match_poll_vote();

create or replace function public.delete_due_match_polls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.match_polls
  where status in ('open', 'converted')
    and kickoff <= now() + interval '1 hour';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reject_late_match_poll_vote() from public, anon, authenticated;
revoke all on function public.reject_late_match_poll_creation() from public, anon, authenticated;
revoke all on function public.delete_due_match_polls() from public, anon, authenticated;

-- Rimuove subito i sondaggi già dentro l'ultima ora.
select public.delete_due_match_polls();

-- La scadenza è controllata ogni minuto; i match creati dai sondaggi restano intatti.
do $$
declare
  old_job record;
begin
  for old_job in
    select jobid from cron.job where jobname = 'delete-due-match-polls'
  loop
    perform cron.unschedule(old_job.jobid);
  end loop;

  perform cron.schedule(
    'delete-due-match-polls',
    '* * * * *',
    'select public.delete_due_match_polls();'
  );
end;
$$;
