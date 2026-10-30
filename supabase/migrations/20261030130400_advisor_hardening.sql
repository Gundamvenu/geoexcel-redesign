-- Geo Excel backend, migration 5: fixes from the Supabase security advisor.

-- Supabase's default privileges grant EXECUTE on new functions to anon, authenticated and service_role.
-- `revoke ... from public` (migration 3) does not remove those explicit grants, so signed-in users could
-- still call submit_quotation. The public form is anonymous-only (session-less client), so remove it.
revoke execute on function public.submit_quotation(text, text, text, text, text, jsonb, text, text, text) from authenticated;

-- Make the "nobody reads secrets through the API" intent explicit (silences rls_enabled_no_policy).
create policy "no direct access to app secrets" on private.app_secrets
  for all to anon, authenticated using (false) with check (false);
