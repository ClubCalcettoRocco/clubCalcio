-- Aggiunge gli stili Future Star e Shape e rimuove TOTS dalle estetiche personali.
-- Eseguire dopo player-card-styles.sql.

alter table public.players
  drop constraint if exists players_card_style_check;

update public.players
   set card_style = 'auto'
 where card_style = 'tots';

alter table public.players
  add constraint players_card_style_check
  check (card_style in (
    'auto', 'bronze', 'silver', 'gold',
    'totw', 'toty', 'hero', 'prime',
    'futurestar', 'shape'
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
    'totw', 'toty', 'hero', 'prime',
    'futurestar', 'shape'
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
