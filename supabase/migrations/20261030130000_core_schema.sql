-- Geo Excel backend, migration 1 of 4: core schema.
-- Tables, constraints, indexes, updated_at triggers, human-readable quotation references.
-- Nothing here is destructive; every object is created fresh.

create type public.quotation_status as enum ('new', 'in_review', 'quoted', 'won', 'lost', 'closed');

-- Shared trigger: keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- products
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 200),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  category          text not null check (char_length(category) between 1 and 80),
  short_description text check (char_length(short_description) <= 600),
  specs             jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  unit              text check (char_length(unit) <= 30),
  price_note        text check (char_length(price_note) <= 200),  -- optional free text, never invented
  image_url         text check (char_length(image_url) <= 500),
  is_active         boolean not null default true,
  is_sample         boolean not null default false,               -- true for seeded SAMPLE rows; see supabase/delete_sample_data.sql
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index products_category_idx on public.products (category);
create index products_active_idx on public.products (is_active) where is_active;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- customers
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  company    text check (char_length(company) <= 160),
  email      text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone      text check (char_length(phone) <= 40),
  country    text check (char_length(country) <= 80),
  city       text check (char_length(city) <= 80),
  notes      text check (char_length(notes) <= 4000),             -- internal, admin-only (table has no public access)
  created_at timestamptz not null default now()
);
create unique index customers_email_lower_key on public.customers (lower(email));
create index customers_created_at_idx on public.customers (created_at desc);

-- -------------------------------------------------------------- quotations
-- Per-year counter behind references such as GX-2026-0001. Only the trigger below touches it.
create table public.quotation_counters (
  year   integer primary key,
  last_n integer not null default 0
);

create table public.quotations (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  customer_id          uuid not null references public.customers (id) on delete restrict,
  status               public.quotation_status not null default 'new',
  message              text check (char_length(message) <= 4000),
  internal_notes       text check (char_length(internal_notes) <= 4000),
  requested_by_ip_hash text,                                       -- salted SHA-256, abuse control only
  notified_at          timestamptz,                                -- set by the notify-quotation edge function
  notify_error         text check (char_length(notify_error) <= 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index quotations_customer_id_idx on public.quotations (customer_id);
create index quotations_status_idx on public.quotations (status);
create index quotations_created_at_idx on public.quotations (created_at desc);
create trigger quotations_set_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();

create function public.assign_quotation_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  y integer := extract(year from (now() at time zone 'Asia/Kolkata'))::integer;
  n integer;
begin
  if new.reference is null or new.reference = '' then
    insert into public.quotation_counters as c (year, last_n)
    values (y, 1)
    on conflict (year) do update set last_n = c.last_n + 1
    returning c.last_n into n;
    new.reference := 'GX-' || y::text || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;
revoke all on function public.assign_quotation_reference() from public, anon, authenticated;
create trigger quotations_assign_reference before insert on public.quotations
  for each row execute function public.assign_quotation_reference();

create table public.quotation_items (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,   -- null = "not sure yet"
  product_name text check (char_length(product_name) <= 200),             -- snapshot, survives product edits/deletes
  quantity     numeric check (quantity is null or (quantity > 0 and quantity <= 1000000000)),
  note         text check (char_length(note) <= 500),
  created_at   timestamptz not null default now()
);
create index quotation_items_quotation_id_idx on public.quotation_items (quotation_id);
create index quotation_items_product_id_idx on public.quotation_items (product_id);

-- ------------------------------------------------------------------ admins
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------- private schema (not exposed by the API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Server-side settings and generated secrets. Values are created inside the database,
-- never committed to the repo and never returned by any API.
create table private.app_secrets (
  key        text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);
revoke all on private.app_secrets from public, anon, authenticated;
alter table private.app_secrets enable row level security;

insert into private.app_secrets (key, value) values
  ('ip_hash_salt',          gen_random_uuid()::text || gen_random_uuid()::text),
  ('notify_webhook_secret', gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (key) do nothing;
