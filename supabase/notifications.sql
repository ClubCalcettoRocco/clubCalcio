-- Notifiche in-app per partite, risultati e apertura votazioni.
-- Eseguire una volta nel SQL Editor del progetto Supabase.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  type text not null check (type in ('match_created', 'result_entered', 'voting_open')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

-- Una riga per ogni dispositivo/browser iscritto alle notifiche push.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_manage_own on public.push_subscriptions;
create policy push_subscriptions_manage_own on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace function public.notify_registered_players_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    v_type := 'match_created';
    v_title := 'Nuova partita';
    v_body := coalesce(new.team_a_name, 'Squadra A') || ' contro ' || coalesce(new.team_b_name, 'Squadra B') || ' · ' || coalesce(new.location, 'luogo da definire');
    insert into public.notifications(user_id, match_id, type, title, body)
    select p.user_id, new.id, v_type, v_title, v_body
      from public.players p
     where p.approved = true and p.user_id is not null;
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'played' then
    v_type := 'result_entered';
    v_title := 'Risultato disponibile';
    v_body := coalesce(new.team_a_name, 'Squadra A') || ' ' || coalesce(new.score_a::text, '0') || '–' || coalesce(new.score_b::text, '0') || ' ' || coalesce(new.team_b_name, 'Squadra B');

    insert into public.notifications(user_id, match_id, type, title, body)
    select p.user_id, new.id, v_type, v_title, v_body
      from public.players p
     where p.approved = true and p.user_id is not null;

    if new.kickoff + interval '24 hours' > now() then
      insert into public.notifications(user_id, match_id, type, title, body)
      select p.user_id, new.id, 'voting_open', 'Votazioni aperte', 'Puoi votare i giocatori che hanno partecipato alla partita.'
        from public.players p
       where p.approved = true and p.user_id is not null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_notify_registered_players on public.matches;
create trigger matches_notify_registered_players
after insert or update of status on public.matches
for each row execute function public.notify_registered_players_for_match();

-- Abilita gli aggiornamenti in tempo reale se la tabella non è già pubblicata.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when undefined_object then
  null;
end;
$$;
