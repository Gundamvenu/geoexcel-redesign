# Geo Excel: buyer-first website redesign

A redesign concept for the **Geo Excel 48-Hour Website Redesign Challenge**, built only from public information
on https://www.geoexcel.group/ and the certificate copies published there. It is a separate repo and deployment; nothing
on Geo Excel's production site or systems was modified or accessed beyond ordinary public page loads.

**Chosen problem:** the current site gives a prospective B2B buyer no clear route from *"what do they sell and can I trust them"*
to *"send an enquiry"*. See [`PROBLEM_SOLUTION.md`](./PROBLEM_SOLUTION.md) (PDF: [`PROBLEM_SOLUTION.pdf`](./PROBLEM_SOLUTION.pdf))
and the evidence in [`audit/FINDINGS.md`](./audit/FINDINGS.md).

## What was built

| Page | Purpose |
|---|---|
| `/` | States what Geo Excel exports, to whom, from where; registrations strip; product lines; 3-step enquiry flow; credentials; heritage; contact CTA |
| `/products/` | Catalogue read live from Supabase (loading, empty and error states; the prebuilt snapshot stays as the no-JavaScript and error fallback), photo per product, category filter (kept in the URL), search (name, spec values, HS code), "Add to enquiry" |
| `/products/<id>/` (44 pages), `/products/view/?slug=` | Prebuilt pages refreshed from Supabase on load; `view` renders any product, including ones an admin adds later. Product photo, specification sheet, "Add to enquiry" and "Quote this product now", "Back to <category>" and "All products" buttons, related products, `Product` JSON-LD |
| `/credentials/` | Each registration in plain text (issuer, scope, issued, valid to) next to the published certificate copy |
| `/enquiry/` | Structured quote request. Each selected product shows its own key facts (variety, region, HS code...) and its own choices (pack size, packaging, size, grade or form, quantity) taken from that product's specification; the message sent lists them per product. Products can be added on this page itself (filter + picker over all 44, or a free-text line for a product that is not listed). Validation; submits through the `submit_quotation` database function and shows the reference number; honeypot; if the server cannot be reached, a copy-to-email fallback |
| `/admin/` | **Separate admin area** (noindex, not linked anywhere, excluded from the sitemap). Sign in with Supabase Auth; only users in `public.admins` see data. Quotations inbox with status and internal notes, customers with history and notes, products with a spec editor and soft delete. See *Backend* below |
| `/about/`, `/sustainability/` | The company's own published text, restructured |
| `/404`, `sitemap-index.xml`, `robots.txt`, favicon, OG image, canonical + OG/Twitter tags | |

Design direction: a trade **spec-sheet / ledger** aesthetic. Warm paper, deep navy ink (the live site's footer navy), the four logo colours
(orange, teal, red, green) used as category codes and as a diagonal "route stripe" taken from the logo's strokes; Fraunces (display), Instrument Sans (text), IBM Plex Mono for spec values and HS codes.
Fonts are self-hosted (no Google requests).

## Tech stack

- **Astro 7** (static output), TypeScript, plain CSS. Small client scripts for the enquiry basket, catalogue filter and form; **Preact** only for the admin area.
- **Supabase**: Postgres with Row Level Security, Auth, an Edge Function (Deno) and `pg_net`. Public pages talk to the REST API with plain `fetch` (no SDK); the admin uses `@supabase/supabase-js`.
- **Resend** (free tier) for notification emails.
- `@astrojs/sitemap` and self-hosted `@fontsource` fonts.
- Playwright + Lighthouse (dev tooling only, in `tools/`) for the audit and verification.

## Setup, run, build

```bash
cd site
npm install
npm run dev          # http://localhost:4321
npm run build        # static site in site/dist
npm run preview      # serve the production build
```

Build-time environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase project URL (public) | required for live data; see `site/.env.example` |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase **publishable** (anon) key (public by design; Row Level Security protects the data) | required for live data |
| `SITE_URL` | Absolute URL of the deployment (canonical, OG image, sitemap, robots) | `https://geoexcel-redesign.example` |
| `BASE_PATH` | Sub-path when hosted on GitHub Pages, e.g. `/geoexcel-redesign` | `/` |

Copy `site/.env.example` to `site/.env` (git-ignored) and fill in the two Supabase values. **The service-role key, the Resend key and every other secret must never go in this file, the repo or the browser.** Without the Supabase variables the prebuilt catalogue still renders, but the quote form cannot submit and the admin cannot sign in.

## Deployment

Static output; deploys unchanged to Netlify, Vercel or GitHub Pages (free tiers).
- **Netlify / Vercel:** root directory `site`, build command `npm run build`, output `dist`. Set `SITE_URL` to the assigned URL.
- **GitHub Pages:** set `SITE_URL=https://<user>.github.io` and `BASE_PATH=/<repo>`, build, publish `site/dist`.

**Currently deployed (GitHub Pages, free tier):**
- Live site: **https://gundamvenu.github.io/geoexcel-redesign/**
- Source: https://github.com/Gundamvenu/geoexcel-redesign (`main`). The static build is published to the `gh-pages` branch.
- Redeploy: `bash tools/deploy-pages.sh` (builds with `SITE_URL` and `BASE_PATH`, adds `.nojekyll`, force-pushes `gh-pages`). On Windows Git Bash the script sets `MSYS_NO_PATHCONV=1`; without it Git Bash rewrites `/geoexcel-redesign` into a Windows path and every link breaks.
- The build reads `site/.env` (Supabase URL and publishable key), so deploy from a machine that has it. The admin area is at `https://gundamvenu.github.io/geoexcel-redesign/admin/`.

## Backend (Supabase)

```
Visitor's browser (static site on GitHub Pages)
  |- public pages --fetch + publishable key--> PostgREST: SELECT active products, RPC submit_quotation
  |- /admin/ -------supabase-js (Auth JWT)---> PostgREST under RLS: is_admin() gates every table
Postgres --AFTER INSERT on quotations--> pg_net --> Edge Function notify-quotation --> Resend --> admin + customer emails
```

Project ref `yipswkxyoulriteybypb` (eu-west-3). SQL is versioned in `supabase/migrations/` and was applied in order:

| Migration | What it does |
|---|---|
| `…130000_core_schema.sql` | Tables, constraints, indexes, `updated_at` triggers, `GX-YYYY-NNNN` references (per-year counter), private schema for database-generated secrets |
| `…130100_rls_policies.sql` | RLS on every table, minimum grants, `private.is_admin()` plus a `public.is_admin()` wrapper |
| `…130200_submit_quotation.sql` | The only public write path (see below) |
| `…130300_notify_trigger.sql` | `pg_net` trigger that calls the edge function after a quotation commits, and `verify_notify_secret()` |
| `…130400_advisor_hardening.sql` | Fixes from the security advisor (revoked `authenticated` from `submit_quotation`, explicit deny policy on private secrets) |

`supabase/seed.sql` loads the 44 catalogue products flagged `is_sample = true` (SAMPLE: imported from the public listing, **not verified**, no prices, no units). `supabase/delete_sample_data.sql` removes them; it is destructive and never run automatically.

### Tables
`products` (name, unique slug, category, short_description, `specs` jsonb, unit, price_note, image_url, is_active, is_sample), `customers` (unique on `lower(email)`), `quotations` (human-readable `reference`, status enum `new / in_review / quoted / won / lost / closed`, message, internal_notes, salted `requested_by_ip_hash`, `notified_at`, `notify_error`), `quotation_items` (product_id nullable for "not sure yet", `product_name` snapshot, quantity, note), `admins` (user_id references auth.users), `quotation_counters` (reference sequence; no access for anyone).
Also added beyond the brief: `quotation_items.product_name`, `quotations.internal_notes / notified_at / notify_error`, `products.is_sample`.

### Row Level Security
| Table | anon | signed-in non-admin | admin (`is_admin()`) |
|---|---|---|---|
| `products` | SELECT active rows only | SELECT active rows only | everything |
| `customers`, `quotations`, `quotation_items`, `admins` | **no access** (no grant, no policy) | no rows | everything |
| `quotation_counters`, `private.app_secrets` | none | none | none (only security-definer code) |

`submit_quotation(name, company, email, phone, message, items jsonb, country, city, website)` is `SECURITY DEFINER`, `EXECUTE` granted to `anon` only. It validates and length-limits every field, rejects a filled honeypot (`website`) with a fake success and no write, limits to **3 requests per email and 10 per network per hour** (salted SHA-256 of the forwarded IP), upserts the customer by email (filling blanks only; an existing name, email or notes are never overwritten by anonymous input), inserts the quotation and items, and returns only the reference. Errors use the prefixes `invalid_input:` and `rate_limited:`.

**Advisors (Supabase CLI `db advisors`, all levels):** security: 1 finding, `anon_security_definer_function_executable` on `submit_quotation`, which is intentional and cannot be removed without removing the public form. Performance: only "unused index" INFO notices, because the database has had almost no traffic yet; the foreign-key, status and created_at indexes are required by the brief.

### Notification emails
`supabase/functions/notify-quotation` (Deno). The database trigger calls it with a shared secret that lives only in `private.app_secrets`; the function checks it through `verify_notify_secret()`, so nothing is copied by hand. It claims the quotation atomically (`notified_at`) so a replay can never send twice, then sends two emails through Resend: the admin gets customer details, products and a link to `/admin/#/quotations/<id>`; the customer gets a short confirmation with the reference. All user-supplied text is HTML-escaped and subject lines are stripped of line breaks. Failures are written to `quotations.notify_error` and shown in the admin inbox.

**Secrets you must set** (never in chat, the repo or the browser). In your own terminal, after `npx supabase login`:
```bash
npx supabase secrets set RESEND_API_KEY=<your Resend API key> ADMIN_NOTIFY_EMAIL=<where alerts go> --project-ref yipswkxyoulriteybypb
# optional: a verified sender, e.g. "Geo Excel <quotes@your-domain>"
npx supabase secrets set MAIL_FROM="Geo Excel <quotes@your-domain>" --project-ref yipswkxyoulriteybypb
```
`SITE_URL` is already set (it is not secret). `SUPABASE_URL` and the service-role key are injected into the function by the platform; this project never reads or logs the service-role key.

**Resend sandbox limitation.** Until you verify a sending domain at resend.com/domains, use the default sender `onboarding@resend.dev`. In that mode Resend only delivers to the email address of the Resend account owner, so the admin alert works only if `ADMIN_NOTIFY_EMAIL` is that address (currently `gundamvenutr@gmail.com`, the Resend account owner), but customer confirmations to anyone else are rejected (recorded as a failure on the quotation). Set `MAIL_FROM` to an address on a verified domain to lift this.

### Running things
```bash
npx supabase login                                  # once, in your own terminal
npx supabase link --project-ref yipswkxyoulriteybypb
# apply a migration (management API, no database password needed):
npx supabase db query --linked --file supabase/migrations/<file>.sql
npx supabase db query --linked --file supabase/seed.sql     # SAMPLE catalogue
npx supabase db advisors --linked --type all --level info
# deploy the edge function (no Docker needed):
npx supabase functions deploy notify-quotation --project-ref yipswkxyoulriteybypb --use-api
# point the trigger at it (URL is not a secret):
#   insert into private.app_secrets (key, value) values ('notify_function_url',
#     'https://yipswkxyoulriteybypb.supabase.co/functions/v1/notify-quotation')
#   on conflict (key) do update set value = excluded.value;
```
Migrations were applied with `db query`, which does not write `supabase_migrations` history. For future changes add a new numbered file and apply it the same way.

### Create the first admin (documented, not auto-run)
1. Dashboard: **Authentication, Users, Add user**, with your email and a strong password (tick auto-confirm).
2. **Authentication, Sign In / Providers**: switch **off** "Allow new users to sign up", so strangers cannot create accounts.
3. SQL editor (this makes that user an admin):
```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```
Then open `/admin/` and sign in. A signed-in user who is not in `admins` sees "Not authorised" and the database returns no rows to them.

## Verification performed (local production build, 30 Oct 2026)

- `tools/check.mjs`: 8 page types at 1440 px and 390 px: HTTP status, one `<h1>`, no missing `alt`, **no horizontal overflow**, no console errors or failed requests.
- `tools/flow.mjs`: 44 assertions (22 per viewport): catalogue filter/search/HS-code search, all 44 product images load, Home link, add/remove, header counter, per-product option sets differ (rice vs spice), per-product pick and quantity appear in the message, pre-fill via "Quote this product now", back link keeps the category, validation and focus, copy-to-email fallback text, success path (submit call mocked so no rows are written), 404, all homepage internal links resolve. **0 failures.**
- `tools/adder.mjs`: 38 assertions (19 per viewport) for the quote-page "Add another product" control: filter, grouped picker, add listed and custom products, focus, persistence across reload, quantities and notes in the message, removal returning the product to the picker. **0 failures.**
- Lighthouse (local preview), home page:

| | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Live site, mobile | 25 | 100 | 77 | 54 | 17.2 s | 0 |
| Live site, desktop | 31 | 100 | 77 | 54 | 5.3 s | 0.004 |
| **Redesign, mobile** | 100 | 100 | 100 | 100 | 1.0 s | 0 |
| **Redesign, desktop** | 98 | 100 | 100 | 100 | 0.9 s | 0 |

Catalogue page (`/products/`, 44 product photos): mobile 90-98 performance, accessibility 100, best practices 100, SEO 100; desktop performance 76-90 (varies run to run with CPU load; LCP about 2.0 s). Raw JSON in `audit/lighthouse/`. Lighthouse is a lab test with simulated throttling; real-user numbers will differ. Automated accessibility scores do not replace a manual screen-reader pass (not done).

### Deployed-URL verification (30 Oct 2026, `verify/`)
Run against the live URL with Playwright (Chromium): `tools/check.mjs`, `flow.mjs`, `adder.mjs`.
- 8 page types at 1440 px and 390 px: HTTP 200 (the deliberate 404 page returns 404), one `<h1>`, no missing `alt`, no horizontal overflow, no console errors or failed requests. Screenshots in `verify/`.
- `flow.mjs`: 44 assertions, 0 failures. `adder.mjs`: 38 assertions, 0 failures. All homepage internal links resolve.
- `sitemap-index.xml` (50 URLs), `robots.txt`, `og.png`, favicon, product photos and certificate images all return 200 with the right content type.
- Lighthouse, live home: mobile 100/100/100/100, desktop 92/100/100/100 (performance/accessibility/best practices/SEO), LCP 1.0-1.1 s, CLS 0 (`audit/lighthouse/redesign-live-home.json`).

### Backend verification (30 Oct 2026)
- `supabase/tests/db_security_checks.sql` (run in a rolled-back transaction, nothing persists): 26 role-simulation checks. anon reads 44 active products and is denied on `customers`, `quotations`, `quotation_items`, `admins`, `quotation_counters`, product writes, `private.is_admin()` and `verify_notify_secret()`; the RPC returns references, ignores a changed name on a repeat email, honours the honeypot, rejects bad input, rate-limits the 4th request per email; a signed-in non-admin sees 0 customers/quotations, `is_admin()` is false, and cannot call the RPC or insert products. All as designed.
- `tools/e2e_backend.mjs` (Playwright, **local preview and the live URL, 1440 px and 390 px**): 62 assertions, 0 failures. Catalogue renders 44 live products from Supabase; error state with retry keeps the snapshot; empty state; spec table from jsonb; unknown product state; anon is refused on every private table over the REST API; invalid input is rejected with `invalid_input`; real submissions returned `GX-2026-0001` to `0006`; client validation, server-error fallback, rate-limit message; admin login page is noindex and refuses wrong credentials. Screenshots in `verify/` and `verify-local-backend/`.
- The database webhook chain was verified end to end: a submission queued a `pg_net` request, the edge function answered 200 after checking the database secret, and recorded "email not configured" because the Resend secrets were not yet set.
- Lighthouse on the live URL: `/products/` mobile 98 / 100 / 100 / 100, desktop 89 / 100 / 100 / 100 (CLS 0); `/enquiry/` mobile 98 / 100 / 100 / 100, desktop 96 / 100 / 100 / 100; `/admin/` performance 95-99, accessibility 100, SEO 50 **by design** (the page is `noindex`).
- **Email delivery verified** with `tools/email_test.py` (one real submission through the public RPC): with `ADMIN_NOTIFY_EMAIL` set to an address that is not the Resend account owner, Resend rejected both emails with 403 (the documented sandbox rule) and the failure was recorded in `quotations.notify_error`, as designed (GX-2026-0007). With `ADMIN_NOTIFY_EMAIL` set to the Resend account's own address, the admin alert and the customer confirmation were both sent, `notified_at` was set and the function returned `{"sent":true,"problems":0}` (GX-2026-0008). Inbox contents were not inspected by this tool.
- **Not yet verified:** admin sign-in and the admin screens (they need an admin account that you create; `e2e_backend.mjs` runs them when `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are set in your own terminal) and non-admin blocking through the UI.

## Known limitations

- **Emails are not sent until `RESEND_API_KEY` and `ADMIN_NOTIFY_EMAIL` are set** (see Backend). Quotations are stored either way and appear in the admin inbox.
- **SEO trade-off:** product pages refresh from Supabase in the browser. The 44 original pages are prebuilt (indexable); products an admin adds later render client-side at `/products/view/?slug=` and are not in the sitemap. Rebuilding pages from the database at deploy time would fix that.
- A returning customer's later name/company/phone changes are not applied automatically (blanks only), by design.
- Rate limiting counts successful requests per email and per forwarded IP; a determined attacker can rotate both. There is no CAPTCHA. Email dispatch is fire-and-forget with no retry queue; a failure is visible in the admin inbox.
- The admin has no password-reset or user-management screen (use the Supabase dashboard) and no audit log.
- The catalogue is SAMPLE data until the company verifies it.
- Product data is **transcribed from the live site, not verified**. Specifications may contain errors in the source; the product pages say so.
- No analytics. Products are edited in the admin area; company facts, credentials and page copy are still code (`site/src/data/`).
- Basket is per-browser (`localStorage`); it does not sync across devices.
- Not tested manually with a screen reader, nor on real iOS/Android devices (Chromium emulation only).
- Single language (English). No customer, shipment or market claims are made, because none are published.

## Placeholder and "needs the company" content

Everything below is clearly marked in the UI or code and must be replaced or confirmed by Geo Excel before any real use.

1. **Certificate validity.** The published FSSAI copy prints validity to **20 Feb 2025**; the Council for Leather Exports copy prints **31 Mar 2024**. Both are shown as printed with an on-page "replace with current copy (placeholder)" note. (`site/src/data/company.ts`)
2. **Udyam and IEC dates** are shown as "See copy" because they were not reliably legible.
3. **Fashion & lifestyle** has no product data on the live site; shown as "Details on request" with no products. Leather footwear is mentioned only because the Council for Leather Exports certificate names it.
4. **Photography.** The 44 product photos, the 5 category images and the logo mark are reused from the live site, paired with products by their position on the live product pages (`tools/product_images.json`, `tools/build_images.py`). Several rice photos are near-identical generic grain shots, and one file is used for two products (PR 11 and 1509 Steam) because the source does so. Confirm rights or replace with owned photography. The logo was re-cropped (mark only) and the wordmark is set in live text.
5. **Resend secrets** (`RESEND_API_KEY`, `ADMIN_NOTIFY_EMAIL`, optional `MAIL_FROM`) are not set yet; the first admin account has to be created by you. **All 44 products are SAMPLE rows** (`is_sample = true`) imported from the public listing.
6. **`SITE_URL`** default is a placeholder until deployed.
7. **OG image** (`site/public/og.png`) is generated from `tools/og.html`; replace with brand artwork if available.
8. **Contact details** (phone, `info@geoexcel.group`, address) are from the live site and certificates; confirm they are current. The registered-office line uses the wording on the FSSAI certificate ("3C-918, 3rd Floor...") which differs slightly from the site's "3C918, 3rd Cross...".

Deliberately **not included** (not publicly verifiable): client names, testimonials, shipment volumes, countries served, years-of-experience counters, awards, team members, response-time promises, pricing, certifications beyond the five published.

### Source-data inconsistencies found and handled
(`tools/catalog_flags.txt`; the live site should fix these at source)
- Duplicates dropped: *1509 Basmati Sella* (listed twice, moisture 11% vs 13%), *PR 11 Steam Long Grain* (listed twice).
- *PR 11*: "Speciality: Pure 1509 Basmati rice" omitted (it is a non-basmati rice).
- *Jeerakasala* and *Palakaddan Matta* rice: specification paragraph omitted (copy of the 1121 Basmati text).
- *Nutmeg*: description omitted (text describes Mace); shelf life "14Yr" omitted.
- Product copy claiming "renowned manufacturer", "market leading prices" and similar was not carried over (the APEDA and Leather Council certificates describe the company as a *merchant exporter*).
- Spelling corrected only (Broccoli, Shelf life, Protein...). HS codes shown exactly as published; two have 7 digits (Ajwain/Fenugreek `0909914`, Pure Ghee `4059020`) and should be confirmed.

## Repository layout

```
site/                Astro project (the website)
  src/pages/         routes (public pages and /admin/)
  src/lib/           Supabase REST client, spec helpers
  src/admin/         Preact admin app
  src/data/          company facts, credentials, static catalogue snapshot (catalog.json is generated)
supabase/            migrations, seed.sql (SAMPLE), delete_sample_data.sql, config.toml, functions/notify-quotation, tests/
audit/               Phase 1 evidence: FINDINGS.md, pages.md, crawl.json, content/, screenshots/, lighthouse/
tools/               crawl.mjs, lh.mjs, check.mjs, flow.mjs, adder.mjs, e2e_backend.mjs, parse_catalog.py, build_catalog.py, build_images.py, build_seed.py, deploy-pages.sh, og.html
verify-local/        screenshots of the redesign from the local build (deployed-URL checks go in verify/)
PROBLEM_SOLUTION.md  problem note (+ PDF)
```

Regenerate the catalogue and photos from the crawl: `python tools/parse_catalog.py && python tools/build_catalog.py && python tools/build_images.py` (needs Pillow).
Re-run the audit: `cd tools && npm i && npx playwright install chromium && node crawl.mjs`.

## Sources
- Geo Excel public site, crawled 30 Oct 2026: https://www.geoexcel.group/ (text in `audit/content/`)
- Certificate copies published at https://www.geoexcel.group/certificates
- Benchmarks (patterns only): https://www.ltfoods.com/ and https://www.kohinoorfoods.in/
- Web searches for independent public information on Geo Excel returned no company profile, news or social pages; only the company's own site was used for facts.
