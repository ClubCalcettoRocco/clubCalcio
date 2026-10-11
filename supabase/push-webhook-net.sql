-- Invia le notifiche in-app a Vercel usando pg_net e il segreto cifrato in Vault.
-- Richiede pg_net attivo e il secret Vault "push_webhook_secret".

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
   where name = 'push_webhook_secret'
   limit 1;

  if webhook_secret is null then
    raise warning 'Secret push_webhook_secret non trovato in Vault';
    return new;
  end if;

  perform net.http_post(
    url := 'https://club-calcio.vercel.app/api/send-push',
    body := jsonb_build_object(
      'type', tg_op,
      'record', to_jsonb(new)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists calcetto_push on public.notifications;

create trigger calcetto_push
after insert on public.notifications
for each row
execute function public.send_push_for_notification();
