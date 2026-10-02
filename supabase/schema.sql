-- CALCETTO CLUB
-- Esegui questo file nel SQL Editor del progetto Supabase.
-- Prima crea almeno il primo account dalla pagina di registrazione dell'app.
-- Dopo la registrazione del primo account, assegna manualmente ADMIN con:
-- update public.players set app_role='ADMIN', approved=true where email='TUAEEMAIL';

create extension if not exists pgcrypto;

create type public.app_role as enum ('PLAYER', 'ADMIN');
create type public.match_type as enum ('calcetto5', 'calciotto8', 'calcio11');
create type public.match_status as enum ('scheduled', 'played');
create type public.team_side as enum ('A', 'B');

create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  photo_url text,
  role_label text,
  app_role public.app_role not null default 'PLAYER',
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  type public.match_type not null,
  kickoff timestamptz not null,
  location text not null,
  team_a_name text not null default 'Squadra A',
  team_b_name text not null default 'Squadra B',
  notes text,
  status public.match_status not null default 'scheduled',
  score_a integer check (score_a is null or score_a >= 0),
  score_b integer check (score_b is null or score_b >= 0),
  mvp_player_id uuid references public.players(id) on delete set null,
  created_by uuid not null references public.players(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  team public.team_side not null,
  rating numeric(3,1) check (rating is null or (rating >= -1 and rating <= 10)),
  primary key (match_id, player_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  scorer_id uuid not null,
  assist_id uuid references public.players(id) on delete set null,
  credited_team public.team_side not null,
  minute integer check (minute is null or (minute >= 0 and minute <= 200)),
  own_goal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint goals_scorer_in_match foreign key (match_id, scorer_id) references public.match_players(match_id, player_id) on delete restrict,
  constraint goals_assist_in_match foreign key (match_id, assist_id) references public.match_players(match_id, player_id) on delete set null
);

create index matches_kickoff_idx on public.matches(kickoff desc);
create index match_players_player_idx on public.match_players(player_id);
create index goals_scorer_idx on public.goals(scorer_id);
create index goals_match_idx on public.goals(match_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger players_updated_at before update on public.players for each row execute function public.set_updated_at();
create trigger matches_updated_at before update on public.matches for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (user_id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- View statistiche: sempre aggiornata, senza valori duplicati manualmente.
create or replace view public.player_stats as
with roster as (
  select mp.player_id,
         count(*) filter (where m.status = 'played')::int as presenze,
         count(mp.rating) filter (where m.status = 'played')::int as valutazioni,
         round(avg(mp.rating) filter (where m.status = 'played' and mp.rating is not null), 2) as media_voto
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  group by mp.player_id
),
goals_scored as (
  select g.scorer_id as player_id, count(*)::int as gol
  from public.goals g
  where g.own_goal = false
  group by g.scorer_id
),
assists as (
  select g.assist_id as player_id, count(*)::int as assist
  from public.goals g
  where g.assist_id is not null and g.own_goal = false
  group by g.assist_id
),
mvps as (
  select m.mvp_player_id as player_id, count(*)::int as mvp
  from public.matches m
  where m.status = 'played' and m.mvp_player_id is not null
  group by m.mvp_player_id
)
select p.id as player_id,
       coalesce(r.presenze, 0)::int as presenze,
       coalesce(g.gol, 0)::int as gol,
       coalesce(a.assist, 0)::int as assist,
       r.media_voto,
       coalesce(r.valutazioni, 0)::int as valutazioni,
       coalesce(v.mvp, 0)::int as mvp
from public.players p
left join roster r on r.player_id = p.id
left join goals_scored g on g.player_id = p.id
left join assists a on a.player_id = p.id
left join mvps v on v.player_id = p.id;

alter view public.player_stats set (security_invoker = true);

create or replace function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.players where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.players where user_id = auth.uid() and app_role = 'ADMIN' and approved = true);
$$;

create or replace function public.current_is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.players where user_id = auth.uid() and approved = true);
$$;

create or replace function public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_role_label text,
  p_photo_url text
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare result public.players;
begin
  update public.players
     set first_name = trim(coalesce(p_first_name, '')),
         last_name = trim(coalesce(p_last_name, '')),
         role_label = nullif(trim(coalesce(p_role_label, '')), ''),
         photo_url = nullif(trim(coalesce(p_photo_url, '')), '')
   where user_id = auth.uid()
   returning * into result;
  if result.id is null then raise exception 'Profilo non trovato'; end if;
  return result;
end;
$$;

create or replace function public.save_match(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_max integer;
  v_type public.match_type;
  v_a uuid[];
  v_b uuid[];
  v_created_by uuid;
  v_old_status public.match_status;
  v_old_type public.match_type;
begin
  if not public.current_is_admin() then raise exception 'Solo un amministratore può gestire le partite'; end if;
  v_type := (p->>'type')::public.match_type;
  v_max := case v_type when 'calcetto5' then 5 when 'calciotto8' then 8 when 'calcio11' then 11 end;
  v_a := coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p->'team_a','[]'::jsonb))), '{}');
  v_b := coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p->'team_b','[]'::jsonb))), '{}');

  if cardinality(v_a) <> v_max or cardinality(v_b) <> v_max then raise exception 'Ogni squadra deve avere esattamente % giocatori', v_max; end if;
  if exists (select 1 from unnest(v_a) a where a = any(v_b)) then raise exception 'Un giocatore non può stare in entrambe le squadre'; end if;
  if (select count(*) from (select unnest(v_a) x union all select unnest(v_b) x) z) <> v_max * 2 then raise exception 'Giocatori duplicati nella partita'; end if;
  if exists (select 1 from unnest(v_a || v_b) x left join public.players pl on pl.id = x where pl.id is null or pl.approved = false) then raise exception 'Tutti i giocatori devono essere approvati'; end if;

  select id into v_created_by from public.players where user_id = auth.uid();
  if p_id is null then
    insert into public.matches (type, kickoff, location, team_a_name, team_b_name, notes, created_by)
    values (v_type, (p->>'kickoff')::timestamptz, trim(p->>'location'), coalesce(nullif(trim(p->>'team_a_name'), ''), 'Squadra A'), coalesce(nullif(trim(p->>'team_b_name'), ''), 'Squadra B'), nullif(trim(coalesce(p->>'notes','')), ''), v_created_by)
    returning id into v_id;
  else
    select status, type into v_old_status, v_old_type from public.matches where id = p_id;
    if not found then raise exception 'Partita non trovata'; end if;
    if v_old_status = 'played' then
      if v_type <> v_old_type then raise exception 'Il tipo di una partita già giocata non può essere cambiato'; end if;
      if (select count(*) from public.match_players where match_id=p_id and team='A' and player_id = any(v_a)) <> v_max
         or (select count(*) from public.match_players where match_id=p_id and team='B' and player_id = any(v_b)) <> v_max then
        raise exception 'Il roster di una partita già giocata non può essere cambiato';
      end if;
      update public.matches set kickoff=(p->>'kickoff')::timestamptz, location=trim(p->>'location'), team_a_name=coalesce(nullif(trim(p->>'team_a_name'), ''), 'Squadra A'), team_b_name=coalesce(nullif(trim(p->>'team_b_name'), ''), 'Squadra B'), notes=nullif(trim(coalesce(p->>'notes','')), '') where id=p_id;
      return p_id;
    end if;
    update public.matches set type=v_type, kickoff=(p->>'kickoff')::timestamptz, location=trim(p->>'location'), team_a_name=coalesce(nullif(trim(p->>'team_a_name'), ''), 'Squadra A'), team_b_name=coalesce(nullif(trim(p->>'team_b_name'), ''), 'Squadra B'), notes=nullif(trim(coalesce(p->>'notes','')), '') where id=p_id;
    v_id := p_id;
    delete from public.match_players where match_id = v_id;
  end if;

  insert into public.match_players(match_id, player_id, team)
  select v_id, x, 'A'::public.team_side from unnest(v_a) x
  union all
  select v_id, x, 'B'::public.team_side from unnest(v_b) x;
  return v_id;
end;
$$;
create or replace function public.save_match_result(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_mvp_player_id uuid,
  p_ratings jsonb,
  p_goals jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g jsonb;
  v_team public.team_side;
  v_scorer_team public.team_side;
  v_assist uuid;
  v_rating numeric;
begin
  if not public.current_is_admin() then raise exception 'Solo un amministratore può registrare il risultato'; end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then raise exception 'Risultato non valido'; end if;
  if not exists (select 1 from public.matches where id=p_match_id) then raise exception 'Partita non trovata'; end if;
  if p_mvp_player_id is not null and not exists (select 1 from public.match_players where match_id=p_match_id and player_id=p_mvp_player_id) then raise exception 'MVP non presente nella partita'; end if;

  update public.match_players mp
  set rating = case when (p_ratings ? mp.player_id::text) then (p_ratings ->> mp.player_id::text)::numeric else null end
  where mp.match_id = p_match_id;

  if exists (select 1 from jsonb_each_text(coalesce(p_ratings,'{}'::jsonb)) e where e.value::numeric < -1 or e.value::numeric > 10) then raise exception 'I voti devono essere compresi tra -1 e 10'; end if;

  delete from public.goals where match_id = p_match_id;
  for g in select * from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) loop
    if (g->>'scorer_id') is null or (g->>'scorer_id') = '' then continue; end if;
    if not exists (select 1 from public.match_players where match_id=p_match_id and player_id=(g->>'scorer_id')::uuid) then raise exception 'Marcatore non presente nella partita'; end if;
    v_scorer_team := (select team from public.match_players where match_id=p_match_id and player_id=(g->>'scorer_id')::uuid);
    v_assist := nullif(g->>'assist_id','')::uuid;
    if v_assist is not null and not exists (select 1 from public.match_players where match_id=p_match_id and player_id=v_assist) then raise exception 'Assist non presente nella partita'; end if;
    v_team := (g->>'credited_team')::public.team_side;
    if coalesce((g->>'own_goal')::boolean, false) = false and v_team <> v_scorer_team then raise exception 'Per un gol normale la squadra a cui è attribuito il gol deve coincidere con quella del marcatore'; end if;
    if coalesce((g->>'own_goal')::boolean, false) = true and v_team = v_scorer_team then raise exception 'Per un autogol il gol deve essere attribuito alla squadra avversaria'; end if;
    insert into public.goals(match_id, scorer_id, assist_id, credited_team, minute, own_goal)
    values (p_match_id, (g->>'scorer_id')::uuid, v_assist, v_team, nullif(g->>'minute','')::integer, coalesce((g->>'own_goal')::boolean, false));
  end loop;

  update public.matches set score_a=p_score_a, score_b=p_score_b, mvp_player_id=p_mvp_player_id, status='played' where id=p_match_id;
end;
$$;

-- RLS
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.goals enable row level security;

create policy players_select on public.players for select using (
  id = public.current_player_id() or approved = true or public.current_is_admin()
);
create policy players_admin_update on public.players for update using (public.current_is_admin()) with check (public.current_is_admin());

create policy matches_select on public.matches for select using (public.current_is_approved());
create policy matches_admin_insert on public.matches for insert with check (public.current_is_admin());
create policy matches_admin_update on public.matches for update using (public.current_is_admin()) with check (public.current_is_admin());
create policy matches_admin_delete on public.matches for delete using (public.current_is_admin());

create policy match_players_select on public.match_players for select using (public.current_is_approved());
create policy match_players_admin_insert on public.match_players for insert with check (public.current_is_admin());
create policy match_players_admin_update on public.match_players for update using (public.current_is_admin()) with check (public.current_is_admin());
create policy match_players_admin_delete on public.match_players for delete using (public.current_is_admin());

create policy goals_select on public.goals for select using (public.current_is_approved());
create policy goals_admin_insert on public.goals for insert with check (public.current_is_admin());
create policy goals_admin_update on public.goals for update using (public.current_is_admin()) with check (public.current_is_admin());
create policy goals_admin_delete on public.goals for delete using (public.current_is_admin());

grant select on public.players, public.matches, public.match_players, public.goals, public.player_stats to authenticated;
grant execute on function public.save_match(uuid, jsonb) to authenticated;
grant execute on function public.save_match_result(uuid, integer, integer, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;

-- Primo admin (da eseguire dopo la prima registrazione):
-- update public.players set app_role='ADMIN', approved=true where email='la-tua-email@example.com';