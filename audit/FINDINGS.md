# Geo Excel – Live site audit (https://www.geoexcel.group/)

Audited **30 Oct 2026** with Playwright (Chromium) + Lighthouse (npm `lighthouse`). The site is a Wix site.
All numbers below were measured in this audit; raw data is in `audit/crawl.json`, `audit/lighthouse/*.json`,
full-page screenshots in `audit/screenshots/`, page text in `audit/content/`.
No form was submitted and nothing was posted to the production site (read-only crawl).

## Scope of the crawl
10 internal pages reachable from the homepage/nav (`audit/pages.md`): `/`, `/about`, `/projects` (labelled "Products"),
`/general-9` (Rice), `/copy-of-rice` (Whole Spices), `/copy-of-whole-spices` (IQF), `/copy-of-whole-spices-1` (Edible Oil & Ghee),
`/fashion-lifestyle`, `/certificates`, `/about-1` (Sustainability). All returned HTTP 200. 10/10 unique links returned 200 (no broken internal links).
No console errors or failed requests on desktop; 6 aborted image requests on `/general-9` mobile (lazy-load cancellations, not user-visible).

## What the company says (source: the site itself)
- Group heritage "since the 1980s" (rice, sugarcane, sesame farming) → cement & steel dealership (1990s) → civil construction (1993–2014, "Anuadi Constructions") → UN SDG/CSR focus (2019) → "GeoExcel" born 2023 for export trade.
- Sells (export): Basmati & non-basmati rice (14 listed items), whole spices (14), IQF frozen vegetables (9), edible oils & ghee (9), "Fashion & Lifestyle" (page has no text).
- Entity shown on the published certificates: **Geoexcel Production Trades Private Limited**, 3C-918, 3rd Cross, 1st Block, HRBR Layout, Bangalore 560043. Contact on site: +91 8035110602, Info@geoexcel.group.
- Published certificate copies (scans): APEDA RCMC (merchant exporter; registered for *frozen potato products*), Council for Leather Exports RCMC (*leather footwear*), FSSAI Central licence (trader/merchant – exporter; printed validity 20-02-2025), Udyam (MSME), IEC.
- **External corroboration:** web searches for the company name/entity (3 queries) returned **no independent public listing, news or social profile** for Geo Excel. The company's own site and its published certificates are the only sources for facts; the redesign uses only those.

## Ranked findings

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | **Critical** | **No enquiry path from any product page.** The 5 product pages (4 with specs for ≈46 SKUs, packaging, HS codes) contain 0 forms, 0 `mailto:`, 0 `tel:`, 0 CTA buttons. Nav item "Contact" links back to the homepage (`https://www.geoexcel.group`), not to a contact page. A buyer reading a spec has nowhere to go. | `crawl.json` → `general-9` etc.: `forms:0, mailto:[], tel:[]`; link list: `Contact → https://www.geoexcel.group`; `screenshots/general-9-desktop-fold.jpg` |
| 2 | **Critical** | **The only enquiry form is generic and weak.** One form, on the homepage footer area: First name, Last name, Email (the only required field), Message. No company, country, product, quantity or pack-size fields; for a B2B exporter these are what a quote needs. Homepage CTA "Get Started" goes to `/projects` (product tiles), not to the form. | `crawl.json` home `forms[0].inputs`; `home-desktop.jpg`; link `Get Started → /projects` |
| 3 | **Critical** | **Value proposition is not stated.** The H1 text is "GEO EXCEL / FOR YOUR BUSINESS" with the sub-line "Facilitating International & Domestic Trade". It does not say *what* (rice, spices, frozen vegetables, oils), *to whom*, or *from where*. Hero is four stock food photos. First-time visitor cannot answer "what do they sell and why trust them" in 5 s. | `home-desktop.jpg`, `content/home.txt` |
| 4 | **High** | **Credibility proof exists but is buried and unreadable.** Certificates page = 5 full-page scanned images with no explanatory text; the *scope* of each (APEDA: frozen potato products; Leather Council: leather footwear; FSSAI: trader/exporter) is only readable inside the image. 13 of 15 homepage images have no alt text; the logo's alt text is a filename (`MagicEraser_240225_235337.PNG`); the hero image alt is `Untitled design.png`. Homepage never mentions certificates, customers or markets. The homepage "projects/clients" copy (on `/projects`) is generic ("Our clients include food grain traders, food processing companies, and government agencies") with no names, countries or numbers. | `certificates-desktop.jpg`, `crawl.json` imgs alt, `content/projects.txt` |
| 5 | **High** | **Not usable on a phone.** At a 390 px viewport every page reports `scrollWidth = 980` (vs `clientWidth = 390`): the desktop layout is scaled/cropped, nav and hero headline are cut off. Lighthouse mobile performance **25/100**, FCP 8.8 s, **LCP 17.2 s**, TBT 3,710 ms. Desktop: performance 31, LCP 5.3 s, TBT 12,110 ms. | `home-mobile-fold.jpg`, `general-9-mobile-fold.jpg`, `lighthouse/home.json` |
| 6 | **High** | **The site tells search engines not to index it.** Every page contains `<meta name="robots" content="noindex">` (checked on `/`, `/about`, `/projects`; Lighthouse `is-crawlable` fails). `robots.txt` advertises `https://www.geoexcel.group/sitemap.xml`, which returns **404**. No meta descriptions on any page (Lighthouse SEO 54/100). Possibly a deliberate "hidden from search" setting that was never turned off. | `curl` of page HTML; `crawl.json extras: /sitemap.xml 404`; `lighthouse/home.json` |
| 7 | Medium | **Titles/headings/URLs are not descriptive.** Product page slugs are `/general-9`, `/copy-of-rice` (= *Whole Spices*), `/copy-of-whole-spices` (= *IQF*), `/copy-of-whole-spices-1` (= *Oil & Ghee*). Every page's first H1 is the brand ("GEO EXCEL"); `/certificates` has **7 H1s**; product pages have no H2/H3 for individual products. No Open Graph image, no structured data. Nav label "Products" points to a URL called `/projects`, and the page mixes "Services / Projects / Certificates" copy with a Products grid. | `pages.md`, `crawl.json` headings |
| 8 | Medium | **Content quality / consistency problems that undermine trust.** Typos ("Armoas", "Shelve Life", "Low Crabs", "Brocolli", "protine"); "HNS Code" instead of HS Code; spec contradictions: *PR 11* (a non-basmati rice, listed twice) has "Speciality: Pure 1509 Basmati rice"; the two *Jeerakasala*/*Palakaddan Matta* entries reuse the 1121 Basmati specification paragraph; *1509 Basmati Sella* is listed twice with different moisture (11% vs 13%); *Nutmeg* description is copied from Mace and lists shelf life "14Yr"; *Ajwain/Fenugreek* HS code `0909914` is 7 digits; the same PR 11 product appears twice. Moisture/Broken values are inconsistent between the table and the spec paragraph of the same product (e.g. 1121 Steam: "Moisture 12%", Sella: "14%" vs "13.5% max"). | `content/general-9.txt`, `content/copy-of-rice.txt` |
| 9 | Medium | **Dead-end / empty pages.** "Fashion & Lifestyle" page contains only the heading "OUR COLLECTIONS" and images with no alt text (6 of 7 missing) and no product text. Homepage "Log In" button exists although there is no member area. A third-party chat bubble overlays content on every page. | `content/fashion-lifestyle.txt`, `screenshots/fashion-lifestyle-desktop.jpg` |
| 10 | Medium | **Certificate currency.** Dates printed on the published copies (read from the full-resolution images): FSSAI "Valid upto 20-02-2025" (refer Annexure); Council for Leather Exports issued 02/03/2024, "Valid upto 31/03/2024"; APEDA issued 22/12/2023, valid to 31/03/2028. At audit date two of the three show a past date. Could be renewals not yet re-uploaded, but a buyer sees apparently expired credentials with no explanation. | `certificates-desktop.jpg` (FSSAI), full-res image read locally |
| 11 | Low | Wix payload: 143–150 requests and 1.1–2.6 MB transferred per page; third-party cookies flagged; best-practices 77/100. Accessibility score 100 (Lighthouse automatic checks only). | `crawl.json nav`, `lighthouse/home.json` |
| 12 | Low | Services list on `/projects` mentions Flavours & Aromas, Pulses & Lentils, Cereals & Grains, Canned Fruits & Vegetables but there are no pages for them – offer is unclear. Typo "Armoas". | `content/projects.txt` |

## Benchmarks (public sites, fetched 30 Oct 2026)
- **LT Foods** – https://www.ltfoods.com/ : hero with one primary CTA ("Explore Our Brands"); four proof counters (years, countries, employees, brands); "Happy to Connect" form with company + phone + message; separate sales/investor/customer emails.
- **Kohinoor Foods** – https://www.kohinoorfoods.in/ : hero "Trusted Across Continents"; proof stats (years, countries, awards); explicit "Request a Quote" and "Get In Touch" form with category and product selectors; certifications (HACCP, ISO, FSSAI, US FDA, Kosher) named in text; plant addresses listed.
- Pattern: comparable food exporters state *what/where* in the hero, show proof as readable text, and give a named quote/contact route with product selectors. Geo Excel's site does none of these. (They are far larger companies; they are used for patterns, not as a claim about Geo Excel's scale.)
- A third benchmark (sunita-exports.com, surfaced by search) could not be used: its domain redirects to an expired-domain page.

## Limits of this audit
- Contact form submission was **not** tested (would create a real message in the company's inbox). Presence of fields and absence of other forms was verified from the DOM.
- Lighthouse run on the homepage only (desktop + mobile); other pages measured with Playwright navigation timings (`crawl.json`).
- Lighthouse accessibility 100 is an automated score and does not prove manual accessibility.
- Lighthouse was run from a local machine with simulated throttling, so absolute numbers vary; the direction (poor mobile performance) is consistent with the measured 980 px layout and 143+ requests.

## PHASE 2 – chosen problem
**Problem:** *The website gives a prospective B2B buyer no clear route from "what do they sell and can I trust them" to "send an enquiry"* – findings 1, 2, 3, 4 (with 5 and 6 as multipliers: it is unusable on mobile and invisible to search).
Redesign target: a buyer-first site with a stated value proposition, readable proof (company registrations with scope exactly as printed), a spec-sheet catalogue with a "Request quote" action on every product, and a structured enquiry form that pre-fills the products selected.
