-- Esegui questo script una volta nel SQL Editor del progetto Supabase.
-- Conserva il link originale per poter annullare il ritaglio dello sfondo.

alter table public.players
  add column if not exists photo_url_original text;

create or replace function public.clear_avatar_original_on_new_photo()
returns trigger
language plpgsql
as $$
begin
  if new.photo_url is distinct from old.photo_url
     and new.photo_url_original is not distinct from old.photo_url_original then
    new.photo_url_original := null;
  end if;
  return new;
end;
$$;

drop trigger if exists players_clear_avatar_original_on_new_photo on public.players;
create trigger players_clear_avatar_original_on_new_photo
before update of photo_url on public.players
for each row
execute function public.clear_avatar_original_on_new_photo();
