import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4321';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const [n, p, y] of [['home', '/', 0], ['home2', '/', 900], ['products', '/products/', 0], ['detail', '/products/1121-basmati-steam-rice/', 0], ['enquiry', '/enquiry/', 0], ['creds', '/credentials/', 300]]) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(300);
  await page.screenshot({ path: `../verify-local/m-${n}.png` });
}
// open mobile menu
await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.click('#menu-btn'); await page.screenshot({ path: '../verify-local/m-menu.png' });
await b.close();
