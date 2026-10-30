import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4321';
const b = await chromium.launch();
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);

for (const [label, vw, vh, mob] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, isMobile: mob, hasTouch: mob });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  const T = (n) => `${label}: ${n}`;

  await page.goto(BASE + '/enquiry/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#add-select option').length > 1, null, { timeout: 20000 });
  const total = await page.locator('#add-select option').count();
  ok(T('picker lists all 44 products when basket is empty'), total === 44, total);
  ok(T('picker is grouped by category'), (await page.locator('#add-select optgroup').count()) === 4);

  // filter then add
  await page.fill('#add-filter', 'cumin');
  ok(T('filter narrows picker to 1'), (await page.locator('#add-select option').count()) === 1);
  await page.click('#add-btn');
  ok(T('product line appears'), (await page.locator('#basket-list li.line').count()) === 1);
  ok(T('focus moves into the new line'), await page.evaluate(() => !!document.activeElement?.closest('#basket-list li.line')));
  ok(T('header badge updates'), (await page.locator('#nav [data-count]').first().textContent()).trim() === '1' || mob);
  ok(T('added product leaves picker'), (await page.locator('#add-select option[value="cumin-seeds"]').count()) === 0);
  ok(T('filter cleared after add'), (await page.inputValue('#add-filter')) === '');

  // add a second listed product via select (no filter) and a custom one
  await page.selectOption('#add-select', 'pure-ghee');
  await page.click('#add-btn');
  ok(T('second product added'), (await page.locator('#basket-list li.line').count()) === 2);
  await page.click('#basket details.custom summary');
  await page.fill('#add-custom', 'Pulses & lentils');
  await page.press('#add-custom', 'Enter');
  ok(T('custom product line appears'), (await page.locator('#basket-list li.line', { hasText: 'Not in catalogue' }).count()) === 1);

  // quantities
  await page.locator('#basket-list li.line').nth(0).locator('input[type=text]').fill('10 MT');
  await page.locator('#basket-list li.line').nth(2).locator('input[type=text]').first().fill('5 MT');
  await page.locator('#basket-list li.line').nth(2).locator('input[type=text]').nth(1).fill('green, 99% purity');

  // empty add shows a message, not an error
  await page.fill('#add-filter', 'zzzz');
  ok(T('no-match state disables picker'), await page.$eval('#add-select', (s) => s.disabled));
  await page.fill('#add-filter', '');

  // reload keeps everything
  await page.reload({ waitUntil: 'networkidle' });
  ok(T('lines survive reload (incl. custom)'), (await page.locator('#basket-list li.line').count()) === 3);
  ok(T('custom quantity survives reload'), (await page.locator('#basket-list li.line').nth(2).locator('input[type=text]').first().inputValue()) === '5 MT');

  // message content
  await page.fill('#name', 'A Buyer'); await page.fill('#company', 'Buyer Co'); await page.fill('#email', 'b@example.com'); await page.fill('#country', 'Oman');
  await page.route('**/rest/v1/rpc/submit_quotation', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
  await page.click('#send');
  await page.waitForSelector('#status:not([hidden])');
  const txt = await page.inputValue('#copy-text');
  ok(T('message lists listed + custom products'), txt.includes('Cumin Seeds') && txt.includes('Pure Ghee') && txt.includes('Pulses & lentils'), txt.slice(-260).replace(/\n/g, ' / '));
  ok(T('message carries quantities and notes'), txt.includes('Quantity: 10 MT') && txt.includes('Quantity: 5 MT') && txt.includes('Notes: green, 99% purity'));

  // remove custom + one listed
  await page.locator('#basket-list li.line').nth(2).locator('.line-head button').click();
  ok(T('custom line removed'), (await page.locator('#basket-list li.line', { hasText: 'Not in catalogue' }).count()) === 0);
  await page.locator('#basket-list li.line').nth(0).locator('.line-head button').click();
  ok(T('removed product returns to picker'), (await page.locator('#add-select option[value="cumin-seeds"]').count()) === 1);

  ok(T('no console errors'), errs.length === 0, errs.join(' | '));
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  ok(T('no horizontal overflow'), sw[0] <= sw[1], sw.join('/'));
  await page.screenshot({ path: `../verify-local/adder-${label}.jpg`, type: 'jpeg', quality: 70 });
  await ctx.close();
}
await b.close();
for (const r of results) console.log(r.join(' | '));
console.log(results.filter((r) => r[0] === 'FAIL').length, 'failures of', results.length);
