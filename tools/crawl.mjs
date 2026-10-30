import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE || 'https://www.geoexcel.group';
const OUT = process.env.OUT || '../audit';
const SHOTS = path.join(OUT, 'screenshots');
const CONTENT = path.join(OUT, 'content');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(CONTENT, { recursive: true });

const host = new URL(BASE).host.replace(/^www\./, '');
const isInternal = (u) => { try { return new URL(u).host.replace(/^www\./, '') === host; } catch { return false; } };
const norm = (u) => { const x = new URL(u); x.hash = ''; let s = x.href; if (s.endsWith('/') && x.pathname !== '/') s = s.slice(0, -1); return s; };
const slug = (u) => { const p = new URL(u).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-'); return p || 'home'; };

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0; const step = 400;
      const t = setInterval(() => { window.scrollBy(0, step); y += step; if (y >= document.body.scrollHeight + 800) { clearInterval(t); window.scrollTo(0, 0); res(); } }, 120);
    });
  });
  await page.waitForTimeout(800);
}

async function extract(page) {
  return await page.evaluate(() => {
    const txt = (e) => (e?.innerText || '').trim().replace(/\s+/g, ' ');
    const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: txt(a), rawHref: a.getAttribute('href') }));
    const imgs = [...document.images].map((i) => ({ src: i.currentSrc || i.src, alt: i.getAttribute('alt'), natW: i.naturalWidth, natH: i.naturalHeight, dispW: Math.round(i.getBoundingClientRect().width), dispH: Math.round(i.getBoundingClientRect().height) }));
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ level: h.tagName, text: txt(h) })).filter((h) => h.text);
    const forms = [...document.querySelectorAll('form')].map((f) => ({ action: f.getAttribute('action'), inputs: [...f.querySelectorAll('input,textarea,select')].map((i) => ({ type: i.type, name: i.name, placeholder: i.placeholder, required: i.required })), buttons: [...f.querySelectorAll('button,input[type=submit]')].map(txt) }));
    const buttons = [...document.querySelectorAll('button,[role=button]')].map(txt).filter(Boolean);
    return {
      title: document.title, h1: [...document.querySelectorAll('h1')].map(txt), metaDesc: meta('description'), ogTitle: meta('og:title'), ogImage: meta('og:image'), canonical: document.querySelector('link[rel=canonical]')?.href || null,
      lang: document.documentElement.lang, links, imgs, headings, forms, buttons,
      text: document.body.innerText,
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, scrollH: document.documentElement.scrollHeight,
      tel: links.filter((l) => l.href.startsWith('tel:')).map((l) => l.href), mailto: links.filter((l) => l.href.startsWith('mailto:')).map((l) => l.href),
      landmarks: { header: !!document.querySelector('header'), nav: !!document.querySelector('nav'), main: !!document.querySelector('main'), footer: !!document.querySelector('footer') },
      smallTap: [...document.querySelectorAll('a,button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 24 || r.width < 24); }).length,
    };
  });
}

const browser = await chromium.launch();
const queue = [norm(BASE + '/')];
const seen = new Set();
const pages = [];
const linkStatus = {};

while (queue.length) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const result = { url, slug: slug(url), consoleErrors: [], failedRequests: [], badResponses: [] };
  for (const [label, vw, vh, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await ctx.newPage();
    const errs = [], fails = [], bad = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 300)));
    page.on('requestfailed', (r) => fails.push(`${r.url().slice(0, 160)} :: ${r.failure()?.errorText}`));
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 160)}`); });
    const t0 = Date.now();
    let resp;
    try { resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { result[label] = { error: String(e) }; await ctx.close(); continue; }
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(1500);
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByType('paint'); const bytes = performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0) + (n?.transferSize || 0); return { dcl: Math.round(n?.domContentLoadedEventEnd || 0), load: Math.round(n?.loadEventEnd || 0), fcp: Math.round(p.find((x) => x.name === 'first-contentful-paint')?.startTime || 0), requests: performance.getEntriesByType('resource').length, bytes }; });
    await autoScroll(page);
    const data = await extract(page);
    await page.screenshot({ path: path.join(SHOTS, `${result.slug}-${label}.png`), fullPage: true });
    // above-the-fold shot
    await page.screenshot({ path: path.join(SHOTS, `${result.slug}-${label}-fold.png`) });
    result[label] = { status: resp?.status(), finalUrl: page.url(), loadMs, nav, consoleErrors: errs, failedRequests: fails, badResponses: bad, ...data };
    if (label === 'desktop') {
      fs.writeFileSync(path.join(CONTENT, `${result.slug}.txt`), `URL: ${url}\nTITLE: ${data.title}\nH1: ${data.h1.join(' | ')}\nMETA DESCRIPTION: ${data.metaDesc}\n\n----- VISIBLE TEXT -----\n${data.text}\n`);
      for (const l of data.links) {
        if (isInternal(l.href) && /^https?:/.test(l.href)) { const n = norm(l.href); if (!seen.has(n) && !queue.includes(n) && !/\.(pdf|jpg|png|zip)$/i.test(n)) queue.push(n); }
      }
    }
    await ctx.close();
  }
  pages.push(result);
  console.log('crawled', url, result.desktop?.status, result.desktop?.loadMs + 'ms');
}

// check all unique links (internal + external) with HEAD/GET
const allLinks = new Map();
for (const p of pages) for (const l of p.desktop?.links || []) { if (/^https?:/.test(l.href)) { const k = norm(l.href); if (!allLinks.has(k)) allLinks.set(k, { from: [], text: l.text }); allLinks.get(k).from.push(p.url); } }
const ctx = await browser.newContext();
for (const [href, info] of allLinks) {
  try { const r = await ctx.request.get(href, { timeout: 20000, maxRedirects: 5 }); linkStatus[href] = { status: r.status(), from: [...new Set(info.from)], text: info.text }; }
  catch (e) { linkStatus[href] = { status: 'ERR', error: String(e).slice(0, 120), from: [...new Set(info.from)], text: info.text }; }
}
// sitemap / robots / 404 behaviour
const extras = {};
for (const p of ['/sitemap.xml', '/robots.txt', '/this-page-does-not-exist-xyz', '/favicon.ico']) {
  try { const r = await ctx.request.get(BASE + p, { timeout: 20000 }); extras[p] = r.status(); } catch (e) { extras[p] = 'ERR'; }
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'crawl.json'), JSON.stringify({ pages, linkStatus, extras }, null, 1));

const rows = pages.map((p) => `| ${p.url} | ${p.desktop?.status} | ${p.desktop?.title} | ${(p.desktop?.h1 || []).join(' / ') || '(none)'} | ${p.desktop?.metaDesc || '(none)'} |`);
fs.writeFileSync(path.join(OUT, 'pages.md'), `| URL | Status | Title | H1 | Meta description |\n|---|---|---|---|---|\n${rows.join('\n')}\n`);
console.log('DONE', pages.length, 'pages', allLinks.size, 'links');
