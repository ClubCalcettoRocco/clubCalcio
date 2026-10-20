-- Esegui questo script nel SQL Editor del progetto Supabase.
-- I livelli di forza sono dati privati: solo gli amministratori possono leggerli o modificarli.

create table if not exists public.player_ai_strength (
  player_id uuid primary key references public.players(id) on delete cascade,
  strength_level smallint not null default 3 check (strength_level between 1 and 5),
  updated_at timestamptz not null default now()
);

alter table public.player_ai_strength enable row level security;

drop policy if exists player_ai_strength_admin_all on public.player_ai_strength;
create policy player_ai_strength_admin_all
  on public.player_ai_strength
  for all
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

revoke all on public.player_ai_strength from anon, authenticated;
grant select, insert, update on public.player_ai_strength to authenticated;

drop trigger if exists player_ai_strength_updated_at on public.player_ai_strength;
create trigger player_ai_strength_updated_at
  before update on public.player_ai_strength
  for each row execute function public.set_updated_at();
