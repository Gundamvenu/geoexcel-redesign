-- Rolled-back checks of the security model. Run with:
--   npx supabase db query --linked --file supabase/tests/db_security_checks.sql
-- Everything happens inside one transaction that is rolled back, so no data persists.

begin;
create temp table results (n serial, check_name text, result text);
grant all on results to anon, authenticated;
grant usage, select on sequence results_n_seq to anon, authenticated;

-- ---------------- as an anonymous visitor
set local role anon;

insert into results (check_name, result) select 'anon reads products (expect 44 active)', count(*)::text from public.products;

insert into results (check_name, result)
select 'anon submit #1 returns reference', public.submit_quotation(
  'Test Buyer', 'Test Imports LLC', 'Test.Buyer@Example.com', '+971500000000', 'Please quote.',
  jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'cardamom'), 'quantity', 2, 'note', 'bold 8mm')),
  'UAE', 'Dubai', '');

insert into results (check_name, result)
select 'anon submit #2, same email different case/name', public.submit_quotation(
  'Someone Else', null, 'test.buyer@example.com', null, 'second request, new name ignored', '[]'::jsonb);

insert into results (check_name, result)
select 'honeypot filled: fake reference, nothing stored', public.submit_quotation(
  'Bot', null, 'bot@example.com', null, 'spam spam spam', '[]'::jsonb, null, null, 'http://spam');

-- direct table access must fail for anon (each in a savepoint so the test can continue)
do $$
declare t text;
begin
  foreach t in array array['customers', 'quotations', 'quotation_items', 'admins', 'quotation_counters'] loop
    begin
      execute format('select count(*) from public.%I', t);
      insert into results (check_name, result) values ('anon select ' || t, 'ALLOWED (BAD)');
    exception when insufficient_privilege then
      insert into results (check_name, result) values ('anon select ' || t, 'denied (good)');
    end;
  end loop;
  begin
    insert into public.products (name, slug, category) values ('x', 'x', 'x');
    insert into results (check_name, result) values ('anon insert product', 'ALLOWED (BAD)');
  exception when insufficient_privilege then
    insert into results (check_name, result) values ('anon insert product', 'denied (good)');
  end;
  begin
    update public.products set is_active = false;
    insert into results (check_name, result) values ('anon update product', 'ALLOWED (BAD)');
  exception when insufficient_privilege then
    insert into results (check_name, result) values ('anon update product', 'denied (good)');
  end;
  begin
    perform private.is_admin();
    insert into results (check_name, result) values ('anon calls private.is_admin', 'ALLOWED (BAD)');
  exception when insufficient_privilege then
    insert into results (check_name, result) values ('anon calls private.is_admin', 'denied (good)');
  end;
  begin
    perform public.verify_notify_secret('x');
    insert into results (check_name, result) values ('anon calls verify_notify_secret', 'ALLOWED (BAD)');
  exception when insufficient_privilege then
    insert into results (check_name, result) values ('anon calls verify_notify_secret', 'denied (good)');
  end;
end $$;

-- input validation and rate limit
do $$
begin
  begin
    perform public.submit_quotation('A', null, 'bad-email', null, 'x', '[]'::jsonb);
    insert into results (check_name, result) values ('invalid input rejected', 'ACCEPTED (BAD)');
  exception when sqlstate '22023' then
    insert into results (check_name, result) values ('invalid input rejected', 'rejected: ' || sqlerrm);
  end;
  begin
    perform public.submit_quotation('Test Buyer', null, 'test.buyer@example.com', null, 'third request, long enough', '[]'::jsonb);
    perform public.submit_quotation('Test Buyer', null, 'test.buyer@example.com', null, 'fourth request must be blocked', '[]'::jsonb);
    insert into results (check_name, result) values ('rate limit per email (3/hour)', 'NOT LIMITED (BAD)');
  exception when sqlstate 'GX429' then
    insert into results (check_name, result) values ('rate limit per email (3/hour)', 'limited: ' || sqlerrm);
  end;
end $$;

-- ---------------- as a signed-in user who is NOT an admin
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into results (check_name, result) select 'non-admin sees customers (expect 0)', count(*)::text from public.customers;
insert into results (check_name, result) select 'non-admin sees quotations (expect 0)', count(*)::text from public.quotations;
insert into results (check_name, result) select 'public.is_admin() for non-admin', public.is_admin()::text;
do $$
begin
  begin
    perform public.submit_quotation('Test', null, 'x@example.com', null, 'hello there world', '[]'::jsonb);
    insert into results (check_name, result) values ('authenticated calls submit_quotation', 'ALLOWED (BAD)');
  exception when insufficient_privilege then
    insert into results (check_name, result) values ('authenticated calls submit_quotation', 'denied (good, anon only)');
  end;
  begin
    insert into public.products (name, slug, category) values ('x', 'x', 'x');
    insert into results (check_name, result) values ('non-admin inserts product', 'ALLOWED (BAD)');
  exception when others then
    insert into results (check_name, result) values ('non-admin inserts product', 'denied (good): ' || sqlstate);
  end;
end $$;

-- ---------------- what was actually stored (as the owner)
reset role;
insert into results (check_name, result) select 'customers stored (expect 1)', count(*)::text from public.customers;
insert into results (check_name, result) select 'customer name kept from first request', name from public.customers;
insert into results (check_name, result) select 'quotations stored', count(*)::text from public.quotations;
insert into results (check_name, result) select 'references', string_agg(reference, ', ' order by created_at) from public.quotations;
insert into results (check_name, result) select 'items stored (expect 1)', count(*)::text from public.quotation_items;
insert into results (check_name, result) select 'item snapshot', product_name || ' x ' || quantity::text from public.quotation_items;

select n, check_name, result from results order by n;
rollback;
