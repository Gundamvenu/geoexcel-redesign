import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4321';
const b = await chromium.launch();
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
for (const [label, vw, vh, mob] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, isMobile: mob, hasTouch: mob });
  const page = await ctx.newPage();
  const errs = []; page.on('console', (m) => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', (e) => errs.push(String(e)));
  const T = (n) => `${label}: ${n}`;
  await page.goto(BASE + '/products/', { waitUntil: 'networkidle' });
  const total = await page.locator('.pcard:visible').count(); ok(T('catalogue shows 44'), total === 44, total);
  await page.click('[data-filter="spices"]');
  ok(T('spices filter = 14'), (await page.locator('.pcard:visible').count()) === 14);
  await page.fill('#q', 'clove'); ok(T('search clove'), (await page.locator('.pcard:visible').count()) === 1);
  await page.fill('#q', ''); await page.click('[data-filter="all"]');
  await page.fill('#q', '10063020'); const hs = await page.locator('.pcard:visible').count(); ok(T('HS-code search finds rice'), hs >= 10, hs); await page.fill('#q', '');
  // product images load
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
  await page.waitForTimeout(2500);
  const brokenImgs = await page.$$eval('.pcard .pimg img', (is) => is.filter((i) => !i.complete || i.naturalWidth === 0).length);
  ok(T('all catalogue product images load'), brokenImgs === 0, brokenImgs);
  // Home link in nav
  if (mob) await page.click('#menu-btn');
  ok(T('Home link present in nav'), (await page.locator('#nav a', { hasText: /^Home$/ }).count()) === 1);
  if (mob) await page.click('#menu-btn');
  // add two products: one rice, one spice (different specs)
  await page.fill('#q', 'basmati'); await page.locator('.pcard:visible [data-add]').first().click();
  await page.fill('#q', 'cardamom'); await page.locator('.pcard:visible [data-add]').first().click(); await page.fill('#q', '');
  // (legacy block below kept for badge checks)
  const addBtns = page.locator('.pcard:visible [data-add]');
  const hdrBadge = page.locator('#nav [data-count]');
  if (mob) await page.click('#menu-btn');
  ok(T('header badge shows 2'), (await hdrBadge.textContent()).trim() === '2');
  // go to enquiry via header CTA
  await page.click('#nav a.btn-accent');
  await page.waitForURL('**/enquiry/');
  ok(T('enquiry lists 2 products'), (await page.locator('#basket-list li').count()) === 2);
  const labelsOf = async (n) => page.locator('#basket-list li.line').nth(n).locator('label').allTextContents();
  const l0 = await labelsOf(0), l1 = await labelsOf(1);
  ok(T('each product has its own option set'), JSON.stringify(l0) !== JSON.stringify(l1), l0.join(',') + ' vs ' + l1.join(','));
  ok(T('product facts (HS code) shown per line'), (await page.locator('#basket-list li.line').nth(0).locator('.line-facts').textContent()).includes('HS code'));
  const sel0 = page.locator('#basket-list li.line').nth(0).locator('select').first();
  const opt = await sel0.locator('option').nth(1).textContent(); await sel0.selectOption({ index: 1 });
  await page.locator('#basket-list li.line').nth(0).locator('input[type=text]').fill('20 MT');
  await page.locator('#basket-list li.line').nth(1).locator('input[type=text]').fill('500 kg');
  // validation
  await page.click('#send');
  const e1 = await page.locator('#name-err').textContent(); ok(T('validation errors shown'), /name/i.test(e1));
  ok(T('focus moved to first invalid'), await page.evaluate(() => document.activeElement?.id === 'name'));
  // fill, submit via mailto fallback
  await page.fill('#name', 'Test Buyer'); await page.fill('#company', 'Test Imports LLC'); await page.fill('#email', 'bad'); await page.click('#send');
  ok(T('invalid email rejected'), /valid email/.test(await page.locator('#email-err').textContent()));
  await page.fill('#email', 'buyer@example.com'); await page.fill('#country', 'UAE'); await page.fill('#qty', 'one 20ft container');
  await page.click('#send');
  await page.waitForSelector('#status:not([hidden])');
  const txt = await page.inputValue('#copy-text');
  ok(T('fallback text has products + fields'), txt.includes('Test Imports LLC') && txt.includes('UAE') && /Products:\n- /.test(txt), txt.replace(/\n/g, ' / ').slice(0, 160));
  // web3forms path (mocked network)
  await page.route('https://api.web3forms.com/submit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'ok' }) }));
  await page.evaluate(() => { document.getElementById('enquiry').dataset.key = 'test-key'; });
  let posted = null; page.on('request', (r) => { if (r.url().includes('web3forms')) posted = r.postData(); });
  await page.click('#send'); await page.waitForFunction(() => document.getElementById('status').classList.contains('ok'));
  ok(T('API path success message'), /has been sent/.test(await page.locator('#status').textContent()));
  ok(T('API payload has access_key and message'), posted && posted.includes('test-key') && posted.includes('Test Imports LLC'));
  ok(T('basket cleared after send'), (await page.locator('#basket-list li').count()) === 0);
  // detail page: image, back link, home
  await page.goto(BASE + '/products/cardamom/', { waitUntil: 'networkidle' });
  ok(T('detail image loads'), await page.$eval('.hero-img img', (i) => i.complete && i.naturalWidth > 0));
  await page.click('text=← Back to Whole spices'); await page.waitForURL('**/products/?c=spices');
  ok(T('back link returns to filtered category'), (await page.locator('.pcard:visible').count()) === 14);
  // quote this product now
  await page.goto(BASE + '/products/pure-ghee/', { waitUntil: 'networkidle' });
  await page.click('.aside a.btn-accent'); await page.waitForURL('**/enquiry/**');
  ok(T('quote-now prefills Pure Ghee'), (await page.locator('#basket-list').textContent()).includes('Pure Ghee'));
  // remove
  await page.click('#basket-list li button'); ok(T('remove from basket'), (await page.locator('#basket-list li').count()) === 0);
  // 404 and links
  const r = await page.goto(BASE + '/does-not-exist/'); ok(T('404 page'), r.status() === 404 && (await page.textContent('h1')).includes('left the port'));
  // all internal links on home resolve
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const hrefs = await page.$$eval('a[href]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))].filter((h) => h.startsWith('/')));
  let broken = [];
  for (const h of hrefs) { const rr = await page.request.get(new URL(h.split('#')[0], BASE).href); if (rr.status() >= 400) broken.push(h + ' ' + rr.status()); }
  ok(T(`home internal links (${hrefs.length}) all resolve`), broken.length === 0, broken.join(','));
  ok(T('no console errors'), errs.filter((e) => !/404/.test(e)).length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close();
for (const r of results) console.log(r.join(' | '));
console.log(results.filter((r) => r[0] === 'FAIL').length, 'failures');
