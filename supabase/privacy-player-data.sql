-- Limit player-table reads to profile fields that are visible to approved members.
-- Admins can retrieve the complete player list (including email) via the guarded RPC.
do $$
declare
  v_public_columns text;
begin
  revoke select on public.players from public, anon, authenticated;
  revoke select (email, user_id, photo_url_original) on public.players from public, anon, authenticated;

  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
    into v_public_columns
  from pg_attribute attribute
  where attribute.attrelid = 'public.players'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attname not in ('email', 'user_id', 'photo_url_original');

  if v_public_columns is null then
    raise exception 'No public profile columns found';
  end if;

  execute format('grant select (%s) on public.players to authenticated', v_public_columns);
end;
$$;

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(player) - array['email', 'user_id', 'photo_url_original']
  from public.players player
  where player.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.admin_list_players()
returns setof public.players
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_is_admin() then
    raise exception 'Solo un amministratore può consultare la lista completa dei giocatori';
  end if;

  return query
    select player.*
    from public.players player
    order by player.first_name, player.last_name;
end;
$$;

revoke all on function public.get_my_profile() from public, anon, authenticated;
grant execute on function public.get_my_profile() to authenticated;
revoke all on function public.admin_list_players() from public, anon, authenticated;
grant execute on function public.admin_list_players() to authenticated;
