-- Promemoria automatici per le partite programmate.
-- Eseguire una volta nel SQL Editor del progetto Supabase.

create extension if not exists pg_cron with schema pg_catalog;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'match_created',
    'result_entered',
    'voting_open',
    'match_reminder_24h',
    'match_reminder_3h'
  ));

create table if not exists public.match_reminder_deliveries (
  match_id uuid not null references public.matches(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('match_reminder_24h', 'match_reminder_3h')),
  sent_at timestamptz not null default now(),
  primary key (match_id, reminder_type)
);

alter table public.match_reminder_deliveries enable row level security;
revoke all on public.match_reminder_deliveries from anon, authenticated;

create or replace function public.create_due_match_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_notifications integer := 0;
begin
  with due_reminders as (
    select
      m.id as match_id,
      'match_reminder_24h'::text as reminder_type,
      'Promemoria partita: domani'::text as title,
      'Domani si gioca ' || coalesce(m.team_a_name, 'Squadra A') || ' contro ' || coalesce(m.team_b_name, 'Squadra B') || ' · ' || coalesce(m.location, 'luogo da definire') as body
    from public.matches m
    where m.status = 'scheduled'
      and m.kickoff > now() + interval '23 hours 45 minutes'
      and m.kickoff <= now() + interval '24 hours'

    union all

    select
      m.id,
      'match_reminder_3h'::text,
      'Promemoria partita: tra poche ore'::text,
      'Tra circa 3 ore si gioca ' || coalesce(m.team_a_name, 'Squadra A') || ' contro ' || coalesce(m.team_b_name, 'Squadra B') || ' · ' || coalesce(m.location, 'luogo da definire')
    from public.matches m
    where m.status = 'scheduled'
      and m.kickoff > now() + interval '2 hours 45 minutes'
      and m.kickoff <= now() + interval '3 hours'
  ), claimed_reminders as (
    insert into public.match_reminder_deliveries (match_id, reminder_type)
    select match_id, reminder_type
    from due_reminders
    on conflict (match_id, reminder_type) do nothing
    returning match_id, reminder_type
  )
  insert into public.notifications (user_id, match_id, type, title, body)
  select distinct
    p.user_id,
    m.id,
    c.reminder_type,
    d.title,
    d.body
  from claimed_reminders c
  join due_reminders d
    on d.match_id = c.match_id and d.reminder_type = c.reminder_type
  join public.matches m on m.id = c.match_id
  join public.match_players mp on mp.match_id = m.id
  join public.players p on p.id = mp.player_id
  where p.approved = true
    and p.user_id is not null;

  get diagnostics inserted_notifications = row_count;
  return inserted_notifications;
end;
$$;

-- Ogni 15 minuti controlla se una partita è entrata nella finestra di promemoria.
select cron.unschedule(jobid)
from cron.job
where jobname = 'calcetto-match-reminders';

select cron.schedule(
  'calcetto-match-reminders',
  '*/15 * * * *',
  'select public.create_due_match_reminders();'
);
