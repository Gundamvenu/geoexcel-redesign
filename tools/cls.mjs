import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: +e.value.toFixed(3), src: (e.sources || []).map((s) => (s.node?.nodeName || '') + '.' + (s.node?.className || s.node?.id || '') + ' ' + JSON.stringify(s.previousRect) + '->' + JSON.stringify(s.currentRect)) }); }).observe({ type: 'layout-shift', buffered: true }); });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(() => window.__cls), null, 1));
// IEC image loads when scrolled
await page.goto('http://localhost:4321/credentials/', { waitUntil: 'networkidle' });
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
console.log(await page.$$eval('.doc img', (is) => is.map((i) => i.alt.slice(0, 20) + ' ' + i.naturalWidth)));
await b.close();
