import { chromium } from 'playwright';

const b = await chromium.launch();
for (const [label, vw, vh, mob] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('geoexcel-enquiry', JSON.stringify(['1121-basmati-steam-rice'])));
  await page.goto('http://localhost:4321/enquiry/', { waitUntil: 'networkidle' });
  await page.click('#basket details.custom summary');
  await page.locator('#basket').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById('basket').scrollIntoView({ block: 'start' }));
  await page.evaluate(() => scrollBy(0, -90));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `../verify-local/picker-${label}.jpg`, type: 'jpeg', quality: 72 });
  await ctx.close();
}
await b.close();
