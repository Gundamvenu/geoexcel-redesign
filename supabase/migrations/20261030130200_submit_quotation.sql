-- Geo Excel backend, migration 3 of 4: the ONLY public write path.
-- submit_quotation validates and length-limits everything, rate-limits, upserts the customer by
-- email, inserts the quotation + items, and returns just the reference number.
--
-- Error contract (the frontend maps on the message prefix):
--   invalid_input: ...   SQLSTATE 22023   a field failed validation
--   rate_limited: ...    SQLSTATE GX429   too many requests from this email / network

create function public.submit_quotation(
  p_name    text,
  p_company text,
  p_email   text,
  p_phone   text,
  p_message text,
  p_items   jsonb,
  p_country text default null,
  p_city    text default null,
  p_website text default null          -- honeypot: real users never fill this in
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name    text := btrim(coalesce(p_name, ''));
  v_company text := nullif(btrim(coalesce(p_company, '')), '');
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_phone   text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_country text := nullif(btrim(coalesce(p_country, '')), '');
  v_city    text := nullif(btrim(coalesce(p_city, '')), '');
  v_items   jsonb := coalesce(p_items, '[]'::jsonb);
  v_ip      text;
  v_salt    text;
  v_hash    text;
  v_count   integer;
  v_customer uuid;
  v_q       uuid;
  v_ref     text;
  v_item    jsonb;
  v_pid     uuid;
  v_pname   text;
  v_qty     numeric;
  v_note    text;
begin
  -- Honeypot: pretend success so bots learn nothing, store nothing.
  if btrim(coalesce(p_website, '')) <> '' then
    return 'GX-' || to_char(now(), 'YYYY') || '-0000';
  end if;

  -- Validation and length limits.
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_input: name must be 2 to 120 characters' using errcode = '22023';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_input: a valid email address is required' using errcode = '22023';
  end if;
  if char_length(coalesce(v_company, '')) > 160 then
    raise exception 'invalid_input: company must be at most 160 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(v_phone, '')) > 40 then
    raise exception 'invalid_input: phone must be at most 40 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(v_country, '')) > 80 or char_length(coalesce(v_city, '')) > 80 then
    raise exception 'invalid_input: country and city must be at most 80 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(v_message, '')) > 4000 then
    raise exception 'invalid_input: message must be at most 4000 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'invalid_input: items must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) > 30 then
    raise exception 'invalid_input: at most 30 items per request' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) = 0 and char_length(coalesce(v_message, '')) < 10 then
    raise exception 'invalid_input: choose at least one product or describe what you need' using errcode = '22023';
  end if;

  -- Network fingerprint for abuse control: salted SHA-256 of the first forwarded address.
  begin
    v_ip := btrim(split_part(coalesce((nullif(current_setting('request.headers', true), '')::json) ->> 'x-forwarded-for', ''), ',', 1));
  exception when others then
    v_ip := null;
  end;
  select s.value into v_salt from private.app_secrets s where s.key = 'ip_hash_salt';
  if coalesce(v_ip, '') <> '' and v_salt is not null then
    v_hash := encode(sha256(convert_to(v_ip || v_salt, 'UTF8')), 'hex');
  end if;

  -- Rate limits: 3 requests per email per hour, 10 per network per hour.
  select count(*) into v_count
  from public.quotations q join public.customers c on c.id = q.customer_id
  where lower(c.email) = v_email and q.created_at > now() - interval '1 hour';
  if v_count >= 3 then
    raise exception 'rate_limited: too many requests for this email, please try again later' using errcode = 'GX429';
  end if;
  if v_hash is not null then
    select count(*) into v_count from public.quotations q
    where q.requested_by_ip_hash = v_hash and q.created_at > now() - interval '1 hour';
    if v_count >= 10 then
      raise exception 'rate_limited: too many requests from this network, please try again later' using errcode = 'GX429';
    end if;
  end if;

  -- Customer: create, or fill in blanks on the existing record. Existing name/email/notes are never
  -- overwritten by anonymous input.
  insert into public.customers as c (name, company, email, phone, country, city)
  values (v_name, v_company, v_email, v_phone, v_country, v_city)
  on conflict (lower(email)) do update
    set company = coalesce(c.company, excluded.company),
        phone   = coalesce(c.phone,   excluded.phone),
        country = coalesce(c.country, excluded.country),
        city    = coalesce(c.city,    excluded.city)
  returning c.id into v_customer;

  insert into public.quotations (customer_id, message, requested_by_ip_hash)
  values (v_customer, v_message, v_hash)
  returning id, reference into v_q, v_ref;

  for v_item in select * from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_input: each item must be an object' using errcode = '22023';
    end if;

    v_pid := null; v_pname := null; v_qty := null;
    begin
      v_pid := nullif(v_item ->> 'product_id', '')::uuid;
      v_qty := nullif(v_item ->> 'quantity', '')::numeric;
    exception when others then
      raise exception 'invalid_input: item has an invalid product or quantity' using errcode = '22023';
    end;

    if v_pid is not null then
      select p.name into v_pname from public.products p where p.id = v_pid and p.is_active;
      if not found then
        raise exception 'invalid_input: unknown product' using errcode = '22023';
      end if;
    else
      -- "not sure yet" / not in the catalogue: optional free-text name
      v_pname := nullif(btrim(coalesce(v_item ->> 'product_name', '')), '');
      if char_length(coalesce(v_pname, '')) > 200 then
        raise exception 'invalid_input: product name must be at most 200 characters' using errcode = '22023';
      end if;
    end if;

    if v_qty is not null and (v_qty <= 0 or v_qty > 1000000000) then
      raise exception 'invalid_input: quantity must be greater than 0' using errcode = '22023';
    end if;
    v_note := nullif(btrim(coalesce(v_item ->> 'note', '')), '');
    if char_length(coalesce(v_note, '')) > 500 then
      raise exception 'invalid_input: item note must be at most 500 characters' using errcode = '22023';
    end if;

    insert into public.quotation_items (quotation_id, product_id, product_name, quantity, note)
    values (v_q, v_pid, v_pname, v_qty, v_note);
  end loop;

  return v_ref;
end;
$$;

-- Anonymous visitors only (plus service_role for tests). The public site uses a session-less client,
-- so even a browser that is also logged in to /admin submits as anon.
revoke all on function public.submit_quotation(text, text, text, text, text, jsonb, text, text, text) from public;
grant execute on function public.submit_quotation(text, text, text, text, text, jsonb, text, text, text)
  to anon, service_role;
