-- Geo Excel backend, migration 2 of 4: Row Level Security.
-- Rule of thumb: anon can only read ACTIVE products. Everything else is admin-only.
-- Public quotation submission happens through ONE security-definer function (migration 3).

-- --------------------------------------------------------------- is_admin()
-- The real check lives in the private schema (not exposed by the API) so that no
-- SECURITY DEFINER function is callable through PostgREST for this purpose.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Convenience wrapper for the admin UI (SECURITY INVOKER, so it does not bypass anything).
create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------ table privileges
-- Start from nothing, then grant the minimum. RLS below is the second line of defence.
revoke all on public.products, public.customers, public.quotations, public.quotation_items,
              public.admins, public.quotation_counters from public, anon, authenticated;

grant select on public.products to anon;
grant select, insert, update, delete on public.products, public.customers, public.quotations,
                                        public.quotation_items, public.admins to authenticated;
-- quotation_counters: no grants for anyone; only the SECURITY DEFINER trigger writes it.

-- -------------------------------------------------------------------- RLS
alter table public.products           enable row level security;
alter table public.customers          enable row level security;
alter table public.quotations         enable row level security;
alter table public.quotation_items    enable row level security;
alter table public.admins             enable row level security;
alter table public.quotation_counters enable row level security;

-- Explicit deny so the intent is visible (and the advisor stays quiet): nobody reads or writes counters directly.
create policy "no direct access to counters" on public.quotation_counters
  for all to anon, authenticated using (false) with check (false);

-- products: public reads active rows; admins read everything and write.
create policy "anon reads active products" on public.products
  for select to anon using (is_active);
create policy "authenticated reads products" on public.products
  for select to authenticated using (is_active or (select private.is_admin()));
create policy "admins insert products" on public.products
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update products" on public.products
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete products" on public.products
  for delete to authenticated using ((select private.is_admin()));

-- customers, quotations, quotation_items, admins: admins only, no anon policy at all.
create policy "admins select customers" on public.customers
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert customers" on public.customers
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update customers" on public.customers
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete customers" on public.customers
  for delete to authenticated using ((select private.is_admin()));

create policy "admins select quotations" on public.quotations
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert quotations" on public.quotations
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update quotations" on public.quotations
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete quotations" on public.quotations
  for delete to authenticated using ((select private.is_admin()));

create policy "admins select quotation_items" on public.quotation_items
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert quotation_items" on public.quotation_items
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update quotation_items" on public.quotation_items
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete quotation_items" on public.quotation_items
  for delete to authenticated using ((select private.is_admin()));

create policy "admins select admins" on public.admins
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert admins" on public.admins
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins delete admins" on public.admins
  for delete to authenticated using ((select private.is_admin()));
