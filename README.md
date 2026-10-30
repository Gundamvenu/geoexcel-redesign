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
| `/products/` | 44-product catalogue with a photo per product, category filter (kept in the URL), search (name, spec values, HS code), "Add to enquiry" |
| `/products/<id>/` (44 pages) | Product photo, specification sheet, "Add to enquiry" and "Quote this product now", "Back to <category>" and "All products" buttons, related products, `Product` JSON-LD |
| `/credentials/` | Each registration in plain text (issuer, scope, issued, valid to) next to the published certificate copy |
| `/enquiry/` | Structured quote request. Each selected product shows its own key facts (variety, region, HS code...) and its own choices (pack size, packaging, size, grade or form, quantity) taken from that product's specification; the message sent lists them per product. Products can be added on this page itself (filter + picker over all 44, or a free-text line for a product that is not listed). Validation; Web3Forms or email fallback |
| `/about/`, `/sustainability/` | The company's own published text, restructured |
| `/404`, `sitemap-index.xml`, `robots.txt`, favicon, OG image, canonical + OG/Twitter tags | |

Design direction: a trade **spec-sheet / ledger** aesthetic. Warm paper, deep navy ink (the live site's footer navy), the four logo colours
(orange, teal, red, green) used as category codes and as a diagonal "route stripe" taken from the logo's strokes; Fraunces (display), Instrument Sans (text), IBM Plex Mono for spec values and HS codes.
Fonts are self-hosted (no Google requests).

## Tech stack

- **Astro 7** (static output), TypeScript, plain CSS. No UI framework; small client scripts for the enquiry basket, catalogue filter and form.
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

Build-time environment variables (all optional):

| Variable | Purpose | Default |
|---|---|---|
| `SITE_URL` | Absolute URL of the deployment (canonical, OG image, sitemap, robots) | `https://geoexcel-redesign.example` |
| `BASE_PATH` | Sub-path when hosted on GitHub Pages, e.g. `/geoexcel-redesign` | `/` |
| `PUBLIC_WEB3FORMS_KEY` | [Web3Forms](https://web3forms.com) access key (free). Enables real form submission | unset (email fallback) |

### Enquiry form behaviour
- **With `PUBLIC_WEB3FORMS_KEY`:** the form posts to Web3Forms and shows a success/failure message. Enquiries go to the email address the key was created for.
- **Without it (current default):** the form validates, builds the enquiry text, opens the visitor's email app addressed to `info@geoexcel.group` (the public address on the live site) and shows a copy-to-clipboard fallback.
- A honeypot field filters basic bots. Selected products are kept in `localStorage` (`geoexcel-enquiry`).

## Deployment

Static output; deploys unchanged to Netlify, Vercel or GitHub Pages (free tiers).
- **Netlify / Vercel:** root directory `site`, build command `npm run build`, output `dist`. Set `SITE_URL` to the assigned URL.
- **GitHub Pages:** set `SITE_URL=https://<user>.github.io` and `BASE_PATH=/<repo>`, build, publish `site/dist`.

Deployment status and the live URL are recorded at the bottom of this file once published.

## Verification performed (local production build, 30 Oct 2026)

- `tools/check.mjs`: 8 page types at 1440 px and 390 px: HTTP status, one `<h1>`, no missing `alt`, **no horizontal overflow**, no console errors or failed requests.
- `tools/flow.mjs`: 44 assertions (22 per viewport): catalogue filter/search/HS-code search, all 44 product images load, Home link, add/remove, header counter, per-product option sets differ (rice vs spice), per-product pick and quantity appear in the message, pre-fill via "Quote this product now", back link keeps the category, validation and focus, email fallback text, Web3Forms path (network mocked), 404, all homepage internal links resolve. **0 failures.**
- `tools/adder.mjs`: 38 assertions (19 per viewport) for the quote-page "Add another product" control: filter, grouped picker, add listed and custom products, focus, persistence across reload, quantities and notes in the message, removal returning the product to the picker. **0 failures.**
- Lighthouse (local preview), home page:

| | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Live site, mobile | 25 | 100 | 77 | 54 | 17.2 s | 0 |
| Live site, desktop | 31 | 100 | 77 | 54 | 5.3 s | 0.004 |
| **Redesign, mobile** | 100 | 100 | 100 | 100 | 1.0 s | 0 |
| **Redesign, desktop** | 98 | 100 | 100 | 100 | 0.9 s | 0 |

Catalogue page (`/products/`, 44 product photos): mobile 90-98 performance, accessibility 100, best practices 100, SEO 100; desktop performance 76-90 (varies run to run with CPU load; LCP about 2.0 s). Raw JSON in `audit/lighthouse/`. Lighthouse is a lab test with simulated throttling; real-user numbers will differ. Automated accessibility scores do not replace a manual screen-reader pass (not done).

## Known limitations

- **The form cannot deliver to a Geo Excel inbox until a Web3Forms key is set**, or someone sends the generated email. The email fallback depends on the visitor having an email client.
- Product data is **transcribed from the live site, not verified**. Specifications may contain errors in the source; the product pages say so.
- No analytics, no CMS: content edits are code edits (`site/src/data/`).
- Basket is per-browser (`localStorage`); it does not sync across devices.
- Not tested manually with a screen reader, nor on real iOS/Android devices (Chromium emulation only).
- Single language (English). No customer, shipment or market claims are made, because none are published.

## Placeholder and "needs the company" content

Everything below is clearly marked in the UI or code and must be replaced or confirmed by Geo Excel before any real use.

1. **Certificate validity.** The published FSSAI copy prints validity to **20 Feb 2025**; the Council for Leather Exports copy prints **31 Mar 2024**. Both are shown as printed with an on-page "replace with current copy (placeholder)" note. (`site/src/data/company.ts`)
2. **Udyam and IEC dates** are shown as "See copy" because they were not reliably legible.
3. **Fashion & lifestyle** has no product data on the live site; shown as "Details on request" with no products. Leather footwear is mentioned only because the Council for Leather Exports certificate names it.
4. **Photography.** The 44 product photos, the 5 category images and the logo mark are reused from the live site, paired with products by their position on the live product pages (`tools/product_images.json`, `tools/build_images.py`). Several rice photos are near-identical generic grain shots, and one file is used for two products (PR 11 and 1509 Steam) because the source does so. Confirm rights or replace with owned photography. The logo was re-cropped (mark only) and the wordmark is set in live text.
5. **Web3Forms key**: not set (see above).
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
  src/pages/         routes
  src/data/          company facts, credentials, catalogue (catalog.json is generated)
audit/               Phase 1 evidence: FINDINGS.md, pages.md, crawl.json, content/, screenshots/, lighthouse/
tools/               crawl.mjs, lh.mjs, check.mjs, flow.mjs, parse_catalog.py, build_catalog.py, build_images.py, adder.mjs, og.html
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
