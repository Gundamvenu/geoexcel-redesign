import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:4321';
const OUT = process.argv[3] || '../verify-local';
fs.mkdirSync(OUT, { recursive: true });
const pages = ['/', '/products/', '/products/1121-basmati-steam-rice/', '/credentials/', '/about/', '/sustainability/', '/enquiry/', '/nope/'];
const b = await chromium.launch();
let bad = 0;
for (const [label, vw, vh, mob] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  for (const p of pages) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e));
    page.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
    const resp = await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, noAlt: [...document.images].filter((i) => i.getAttribute('alt') === null).length, title: document.title }));
    const slug = (p === '/' ? 'home' : p.replace(/\//g, '-').replace(/^-|-$/g, ''));
    await page.screenshot({ path: `${OUT}/${slug}-${label}.png`, fullPage: true });
    const flag = (m.sw > m.cw || errs.length || m.h1 !== 1 || m.noAlt) ? 'XX' : 'ok';
    if (flag === 'XX') bad++;
    console.log(label, p, resp.status(), flag, JSON.stringify(m), errs.slice(0, 3).join(' | '));
    await page.close();
  }
  await ctx.close();
}
await b.close();
console.log('issues:', bad);
