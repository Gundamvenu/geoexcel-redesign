-- Geo Excel backend, migration 4 of 4: email notification trigger.
-- After a quotation commits, pg_net calls the `notify-quotation` edge function.
-- The request is queued inside the same transaction, so a rolled-back submission sends nothing.
--
-- Not configured yet = silently skipped. To enable after deploying the edge function, run once
-- (replace <project-ref>; this URL is not a secret):
--   insert into private.app_secrets (key, value)
--   values ('notify_function_url', 'https://<project-ref>.supabase.co/functions/v1/notify-quotation')
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pg_net with schema extensions;

create function private.notify_quotation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select s.value into v_url    from private.app_secrets s where s.key = 'notify_function_url';
  select s.value into v_secret from private.app_secrets s where s.key = 'notify_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('quotation_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- A failed email dispatch must never block a customer's quotation request.
  return new;
end;
$$;
revoke all on function private.notify_quotation_created() from public, anon, authenticated;

create trigger quotations_notify after insert on public.quotations
  for each row execute function private.notify_quotation_created();

-- The edge function proves a call came from this database by checking the shared secret here,
-- so the secret never has to be copied by hand. Callable by the service role only.
create function public.verify_notify_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.app_secrets s
    where s.key = 'notify_webhook_secret' and s.value = p_secret
  );
$$;
revoke all on function public.verify_notify_secret(text) from public, anon, authenticated;
grant execute on function public.verify_notify_secret(text) to service_role;
