# Geo Excel redesign: problem and solution

## The problem
Geo Excel (Geoexcel Production Trades Pvt Ltd, Bangalore) exports rice, spices, frozen vegetables and oils, and holds real exporter registrations. A buyer who lands on the current site cannot get from *"what do they sell and can I trust them?"* to *"send an enquiry"*. The site has the content, but no conversion path.

## Supporting observations (live site, audited 30 Oct 2026)
| # | Observation | Evidence |
|---|---|---|
| 1 | **No enquiry path from product pages.** The 5 product pages (4 with specs for about 46 products and HS codes) contain 0 forms, 0 `mailto:`, 0 `tel:`, 0 CTAs. The nav item "Contact" links back to the homepage. | Playwright DOM extraction; `audit/screenshots/general-9-desktop-fold.jpg` |
| 2 | **One generic form, weak CTA.** 4 fields, only email required; no company, country, product or quantity. The hero CTA "Get Started" goes to the product grid, not the form. | `audit/crawl.json` (home); `home-desktop.jpg` |
| 3 | **Value proposition is missing.** H1 reads "GEO EXCEL / FOR YOUR BUSINESS". Nothing says what is sold, to whom or from where. | `audit/content/home.txt` |
| 4 | **Proof is buried.** Credentials are 5 scanned images with no text and 7 H1s. What each covers (APEDA: frozen potato products; Leather Council: leather footwear; FSSAI: trader/exporter) is readable only inside the image. 13 of 15 homepage images lack alt text; two certificates print past validity dates. | `certificates-desktop.jpg`; full-resolution certificate scans |
| 5 | **Amplifiers.** At 390 px every page is 980 px wide (layout cropped); Lighthouse mobile performance 25, LCP 17.2 s. Every page carries `noindex` and the sitemap returns 404, so new buyers are unlikely to find it. | `home-mobile-fold.jpg`; `audit/lighthouse/home.json`; page source |

Full ranked list of 12 findings: `audit/FINDINGS.md`. Benchmarks (LT Foods, Kohinoor Foods) show comparable exporters state what/where in the hero, show proof as text, and offer a named quote route with product selectors.

## How the redesign addresses it
1. **State the offer** in the first screen: "Indian rice, spices, frozen vegetables & oils, exported to order", with the registered company name and two actions: *Request a quote* and *Browse 44 products*.
2. **Make proof readable and honest.** A registrations strip and a Credentials page give issuer, scope, issued and valid-to dates as printed, beside each certificate copy. Expired-looking dates are flagged, not hidden. No clients, numbers or testimonials are invented.
3. **Turn the catalogue into a quote tool.** 44 spec-sheet pages with a photo, filter and search; every product has *Add to enquiry* and *Quote this product now*; the header shows the count, and Home / back-to-category links keep navigation easy.
4. **A structured enquiry form** that arrives pre-filled with the selected products. Each product carries its own spec choices (pack size, packaging, size or grade, quantity), and the form asks for company and destination. It uses Web3Forms when a key is set and otherwise opens a pre-addressed email.
5. **Remove the amplifiers:** responsive from 390 px, indexable, with unique titles and descriptions, one H1 per page, sitemap, canonical and OG tags. Local Lighthouse: mobile 100/100/100/100 (performance/accessibility/best practices/SEO), LCP 1.0 s, versus 25/100/77/54 and 17.2 s on the live site.

## How success would be measured
Baselines do not exist (no analytics access), so the first step is to instrument the current site for 2-4 weeks.
- **Primary:** qualified enquiries per 100 visits (form or email sent with company, destination and at least one product).
- **Funnel:** share of product views that add to enquiry; share of enquiry-page views that submit; share of enquiries naming a product and quantity.
- **Reach:** indexed pages and non-branded impressions in Search Console; mobile share of sessions and mobile conversion rate.
- **Quality:** enquiries that need no follow-up question, and enquiries per product line.
- **Guardrails:** Lighthouse mobile ≥ 90, zero broken links in CI.

## What I would do next
1. Replace placeholders with real data: current certificates, a Web3Forms (or CRM) endpoint owned by Geo Excel, owned photography.
2. Have the company correct the product data errors listed in the README, and confirm which products each registration actually covers.
3. Add analytics (privacy-friendly) and Search Console; verify the `noindex` flag was unintended before any launch on the live domain.
4. Add only what the company can document: markets served, sample/lead-time policy, packing and documentation list, named references with permission.
5. Interview 3-5 real buyers or the sales team to learn the questions asked before ordering, and test the form with them.

*Scope note:* this is a concept built from public information. Everything not publicly verifiable is marked as placeholder in the code and README.
