-- Mantiene nella tabella solo le notifiche delle ultime 48 ore.
-- Eseguire dopo notifications.sql e dopo aver abilitato pg_cron.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.cleanup_old_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.notifications
  where created_at < now() - interval '48 hours';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_notifications() from public, anon, authenticated;

-- Elimina subito gli eventuali record già più vecchi di 48 ore.
select public.cleanup_old_notifications();

-- Sostituisce un eventuale job precedente e ripulisce ogni ora.
do $$
declare
  old_job record;
begin
  for old_job in
    select jobid from cron.job where jobname = 'cleanup-old-notifications'
  loop
    perform cron.unschedule(old_job.jobid);
  end loop;

  perform cron.schedule(
    'cleanup-old-notifications',
    '0 * * * *',
    'select public.cleanup_old_notifications();'
  );
end;
$$;
