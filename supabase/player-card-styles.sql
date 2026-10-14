-- Stili grafici personali per le carte dei giocatori.
-- Eseguire una volta nel SQL Editor del progetto Supabase.

alter table public.players
  add column if not exists card_style text not null default 'auto';

alter table public.players
  drop constraint if exists players_card_style_check;

alter table public.players
  add constraint players_card_style_check
  check (card_style in (
    'auto', 'bronze', 'silver', 'gold',
    'totw', 'toty', 'tots', 'hero', 'prime'
  ));

create or replace function public.set_my_card_style(p_card_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  if p_card_style not in (
    'auto', 'bronze', 'silver', 'gold',
    'totw', 'toty', 'tots', 'hero', 'prime'
  ) then
    raise exception 'Stile carta non valido';
  end if;

  update public.players
     set card_style = p_card_style
   where user_id = auth.uid()
     and approved = true
  returning id into v_player_id;

  if v_player_id is null then
    raise exception 'Profilo giocatore approvato non trovato';
  end if;
end;
$$;

revoke all on function public.set_my_card_style(text) from public;
grant execute on function public.set_my_card_style(text) to authenticated;
