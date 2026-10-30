// End-to-end checks for the Supabase-backed site, driven by Playwright.
//
//   node tools/e2e_backend.mjs <base-url> <screenshot-dir>
//
// Anonymous checks always run. Admin checks run only if you set these in YOUR terminal (never share them):
//   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD            an account listed in public.admins
//   E2E_USER_EMAIL,  E2E_USER_PASSWORD  (optional) a signed-in account that is NOT an admin
// Test data it creates is tagged "E2E TEST" with gx-e2e-*@example.com emails and a gx-e2e-* product slug.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
const SHOTS = process.argv[3] || '../verify';
fs.mkdirSync(SHOTS, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(new URL('../site/.env', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const API = env.PUBLIC_SUPABASE_URL, KEY = env.PUBLIC_SUPABASE_ANON_KEY;
const stamp = Date.now();
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, String(extra).slice(0, 160)]); };
const rest = (page, path, init = {}) => page.request.fetch(API + path, { ...init, headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init.headers || {}) } });
const hasAdmin = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);

const b = await chromium.launch();
for (const [label, vw, vh, mob] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, isMobile: mob, hasTouch: mob });
  // E2E_SKIP_SUBMIT=1 answers the submit call with a mock so repeat runs do not add rows to the database.
  if (process.env.E2E_SKIP_SUBMIT) await ctx.route('**/rest/v1/rpc/submit_quotation', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '"GX-2026-9999"' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  const T = (n) => `${label}: ${n}`;
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}-${label}.jpg`, type: 'jpeg', quality: 70, fullPage: true });

  // ---------- anonymous: catalogue from Supabase
  await page.goto(BASE + '/products/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#grid .pcard[data-live]').length === 44, null, { timeout: 20000 });
  ok(T('catalogue renders 44 LIVE products from Supabase'), (await page.locator('#grid .pcard[data-live]').count()) === 44, await page.locator('#grid .pcard[data-live]').count());
  ok(T('category chips built from data'), (await page.locator('#chips .chip').count()) === 5);
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
  await page.waitForTimeout(1500);
  ok(T('catalogue images load'), (await page.$$eval('#grid .pimg img', (is) => is.filter((i) => !i.complete || !i.naturalWidth).length)) === 0);
  await page.click('#chips [data-filter="spices"]');
  ok(T('filter + URL key still work (spices = 14)'), (await page.locator('#grid .pcard:visible').count()) === 14);

  // catalogue states: error then retry, and empty
  await page.route('**/rest/v1/products*', (r) => r.abort());
  await page.goto(BASE + '/products/', { waitUntil: 'load' });
  await page.waitForSelector('#catalog-state.error', { timeout: 20000 });
  ok(T('catalogue ERROR state with retry, snapshot kept'), (await page.locator('#catalog-state button', { hasText: 'Try again' }).count()) === 1 && (await page.locator('#grid .pcard').count()) === 44 && (await page.locator('#grid .pcard[data-live]').count()) === 0);
  await page.unroute('**/rest/v1/products*');
  await page.click('#catalog-state button');
  await page.waitForFunction(() => document.querySelectorAll('#grid .pcard[data-live]').length === 44, null, { timeout: 20000 });
  ok(T('retry recovers the live catalogue'), true);
  await page.route('**/rest/v1/products*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(BASE + '/products/', { waitUntil: 'load' });
  await page.waitForSelector('#catalog-state.empty', { timeout: 20000 });
  ok(T('catalogue EMPTY state'), /No products are listed/.test(await page.locator('#catalog-state').textContent()));
  await page.unroute('**/rest/v1/products*');

  // product detail: prebuilt page refreshed from the database; unknown slug -> empty state
  await page.goto(BASE + '/products/cardamom/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('p-state').hidden, null, { timeout: 20000 });
  const specs = await page.locator('#p-specs tr').allTextContents();
  ok(T('detail shows spec table from jsonb (HS code row)'), specs.length >= 5 && specs.some((s) => s.includes('HS code')), specs.length);
  await page.goto(BASE + '/products/view/?slug=does-not-exist', { waitUntil: 'load' });
  await page.waitForSelector('#p-state.empty', { timeout: 20000 });
  ok(T('unknown product -> "no longer listed" state'), /no longer listed/.test(await page.locator('#p-state').textContent()));
  await page.goto(BASE + '/products/view/?slug=cardamom', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('p-state').hidden && document.getElementById('p-specs').children.length > 0, null, { timeout: 20000 });
  ok(T('client-rendered product view works'), (await page.textContent('#p-name')).trim() === 'Cardamom');

  // ---------- anonymous: what the database refuses
  for (const t of ['customers', 'quotations', 'quotation_items', 'admins', 'quotation_counters']) {
    const r = await rest(page, `/rest/v1/${t}?select=*&limit=1`);
    const body = await r.text();
    ok(T(`anon cannot read ${t}`), r.status() >= 400 || body === '[]', `${r.status()} ${body.slice(0, 60)}`);
  }
  const w = await rest(page, '/rest/v1/products', { method: 'POST', data: { name: 'x', slug: 'gx-e2e-anon', category: 'x' } });
  ok(T('anon cannot insert products'), w.status() >= 400, w.status());
  for (const fn of ['is_admin', 'verify_notify_secret']) {
    const r = await rest(page, `/rest/v1/rpc/${fn}`, { method: 'POST', data: fn === 'is_admin' ? {} : { p_secret: 'x' } });
    ok(T(`anon cannot call ${fn}()`), r.status() >= 400, r.status());
  }
  const bad = await rest(page, '/rest/v1/rpc/submit_quotation', { method: 'POST', data: { p_name: 'A', p_company: '', p_email: 'nope', p_phone: '', p_message: '', p_items: [] } });
  ok(T('RPC rejects invalid input (400, invalid_input)'), bad.status() === 400 && /invalid_input/.test(await bad.text()), bad.status());

  // ---------- anonymous: submit a quotation through the real form
  const email = `gx-e2e-${stamp}-${label}@example.com`;
  await page.goto(BASE + '/enquiry/?p=cardamom', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('load-state').hidden && document.querySelectorAll('#basket-list li.line').length === 1, null, { timeout: 20000 });
  ok(T('?p= pre-fills a product after loading from Supabase'), true);
  await page.fill('#add-filter', 'pure ghee'); await page.click('#add-btn');
  await page.locator('#basket-list li.line').nth(0).locator('input[type=text]').fill('2 MT');
  await page.fill('#name', 'E2E Tester'); await page.fill('#company', 'E2E TEST Imports'); await page.fill('#email', email);
  await page.fill('#phone', '+10000000000'); await page.fill('#country', 'Testland'); await page.fill('#qty', 'E2E TEST - safe to delete');
  await page.fill('#message', 'E2E TEST - automated check, safe to delete.');
  await page.click('#send');
  await page.waitForSelector('#status.ok', { timeout: 30000 });
  const okText = await page.textContent('#status');
  const ref = (okText.match(/GX-\d{4}-\d{4}/) || [''])[0];
  ok(T('submit success shows a reference'), /^GX-\d{4}-\d{4}$/.test(ref), ref);
  ok(T('form and basket reset after success'), (await page.inputValue('#name')) === '' && (await page.locator('#basket-list li.line').count()) === 0);
  await shot('public-enquiry-success');

  // validation (client) + server error state with the copy fallback
  await page.click('#send');
  ok(T('client validation errors shown'), /name/i.test(await page.textContent('#name-err')));
  await page.goto(BASE + '/enquiry/?p=cardamom', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#basket-list li.line').length === 1, null, { timeout: 20000 });
  await page.fill('#name', 'E2E Tester'); await page.fill('#company', 'E2E TEST'); await page.fill('#email', `gx-e2e-${stamp}-${label}-err@example.com`); await page.fill('#country', 'Testland');
  await page.route('**/rest/v1/rpc/submit_quotation', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
  await page.click('#send');
  await page.waitForSelector('#status.bad', { timeout: 20000 });
  ok(T('server ERROR state + copy-to-email fallback'), !(await page.locator('#fallback').isHidden()) && (await page.inputValue('#copy-text')).includes('Cardamom'));
  await page.route('**/rest/v1/rpc/submit_quotation', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"rate_limited: too many requests for this email, please try again later"}' }));
  await page.click('#send');
  await page.waitForFunction(() => /too many requests/i.test(document.getElementById('status').textContent), null, { timeout: 20000 });
  ok(T('rate-limit message shown to the visitor'), true);
  await page.unroute('**/rest/v1/rpc/submit_quotation');

  // honeypot: bots filling the hidden field get a fake success and nothing is stored
  await page.fill('#website', 'http://spam.example');
  await page.fill('#email', `gx-e2e-${stamp}-${label}-bot@example.com`);
  await page.click('#send');
  await page.waitForSelector('#status.ok', { timeout: 20000 });
  if (process.env.E2E_SKIP_SUBMIT) results.push(['SKIP', T('honeypot returns the fake -0000 reference'), 'needs the real database; covered in the live run']);
  else ok(T('honeypot gets a harmless fake success (-0000)'), /GX-\d{4}-0000/.test(await page.textContent('#status')));

  // ---------- admin (only with credentials supplied in the environment)
  await page.goto(BASE + '/admin/', { waitUntil: 'load' });
  await page.waitForSelector('#a-email', { timeout: 20000 });
  ok(T('admin shows a login form when signed out'), true);
  ok(T('admin page is noindex'), (await page.getAttribute('meta[name=robots]', 'content')).includes('noindex'));
  await shot('admin-login');
  await page.fill('#a-email', 'nobody@example.com'); await page.fill('#a-pass', 'wrong-password-123'); await page.click('button[type=submit]');
  await page.waitForSelector('.status.bad', { timeout: 20000 });
  ok(T('wrong credentials are refused'), /Sign-in failed/.test(await page.textContent('.status.bad')));
  const nav = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));
  ok(T('admin login page does not link to the public site data'), !nav.some((h) => /customers|quotations/.test(h || '')));

  if (process.env.E2E_USER_EMAIL) {
    await page.fill('#a-email', process.env.E2E_USER_EMAIL); await page.fill('#a-pass', process.env.E2E_USER_PASSWORD); await page.click('button[type=submit]');
    await page.waitForSelector('text=Not authorised', { timeout: 20000 });
    ok(T('non-admin account is blocked ("Not authorised")'), true);
    const tok = await page.evaluate(() => JSON.parse(localStorage.getItem('geoexcel-admin-auth') || '{}').access_token);
    const r = await rest(page, '/rest/v1/customers?select=*', { headers: { Authorization: `Bearer ${tok}` } });
    ok(T('non-admin token reads no customers (RLS)'), (await r.text()) === '[]', r.status());
    await page.click('text=Sign out');
  }

  if (hasAdmin) {
    await page.goto(BASE + '/admin/', { waitUntil: 'load' });
    await page.waitForSelector('#a-email');
    await page.fill('#a-email', process.env.E2E_ADMIN_EMAIL); await page.fill('#a-pass', process.env.E2E_ADMIN_PASSWORD); await page.click('button[type=submit]');
    await page.waitForSelector('h1:has-text("Quotation requests")', { timeout: 30000 });
    ok(T('admin signs in and sees the quotations inbox'), true);
    // With E2E_SKIP_SUBMIT nothing new was written, so work on an existing test quotation (search "gx-e2e").
    const reuse = Boolean(process.env.E2E_SKIP_SUBMIT);
    await page.fill('#q-search', reuse ? 'gx-e2e' : email);
    await page.waitForSelector(reuse ? 'table.data tbody tr' : `table.data tbody tr:has-text("${ref}")`, { timeout: 20000 });
    ok(T(reuse ? 'test quotations appear in the inbox' : 'new quotation appears in the inbox'), true);
    await shot('admin-quotations');
    await page.click(reuse ? 'table.data tbody a' : `table.data a:has-text("${ref}")`);
    await page.waitForSelector('#qd-status');
    const aref = reuse ? ((await page.textContent('h1')).match(/GX-\d{4}-\d{4}/) || [''])[0] : ref;
    ok(T('detail shows customer, items and message'), (await page.textContent('main')).includes('E2E TEST Imports') && (await page.textContent('main')).includes('Cardamom'));
    await page.selectOption('#qd-status', 'quoted');
    await page.waitForSelector('.status.ok:has-text("Status updated")');
    await page.fill('#qd-notes', 'E2E TEST internal note'); await page.click('button:has-text("Save notes")');
    await page.waitForSelector('.status.ok:has-text("Notes saved")');
    await page.reload(); await page.waitForSelector('#qd-status');
    ok(T('status and notes persisted'), (await page.inputValue('#qd-status')) === 'quoted' && (await page.inputValue('#qd-notes')) === 'E2E TEST internal note');
    await shot('admin-quotation-detail');
    await page.goto(BASE + '/admin/#/customers'); await page.fill('#c-search', reuse ? 'gx-e2e' : email);
    await page.click(reuse ? 'table.data tbody a' : `table.data a:has-text("E2E Tester")`);
    await page.waitForSelector('#cd-notes');
    ok(T('customer record shows quotation history'), (await page.textContent('main')).includes('GX-'), aref);
    await page.fill('#cd-notes', 'E2E TEST customer note'); await page.click('button:has-text("Save notes")');
    await page.waitForSelector('.status.ok:has-text("Notes saved")');
    ok(T('customer notes saved'), true);
    // products: add, see on the public site, deactivate
    const slug = `gx-e2e-${stamp}-${label}`;
    await page.goto(BASE + '/admin/#/products'); await page.click('button:has-text("+ Add product")');
    await page.fill('#pf-name', `E2E Test Product ${stamp}`); await page.fill('#pf-slug', slug); await page.fill('#pf-cat', 'Whole spices');
    await page.fill('#sk-0', 'Pack size'); await page.fill('#sv-0', '5 Kg, 25 Kg');
    await page.click('button:has-text("+ Add spec")'); await page.fill('#sk-1', 'HS code'); await page.fill('#sv-1', '000000');
    await shot('admin-product-form');
    await page.click('button:has-text("Save product")');
    await page.waitForSelector(`table.data tr:has-text("${slug}")`, { timeout: 20000 });
    ok(T('admin adds a product'), true);
    await page.goto(BASE + `/products/view/?slug=${slug}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('p-state').hidden && document.getElementById('p-specs').children.length === 2, null, { timeout: 20000 });
    ok(T('new product is live on the public site with its spec table'), true);
    await page.goto(BASE + '/admin/#/products'); await page.fill('#p-search', slug);
    page.once('dialog', (d) => d.accept());
    await page.click(`tr:has-text("${slug}") button:has-text("Deactivate")`);
    await page.waitForSelector('.status.ok:has-text("deactivated")');
    await page.goto(BASE + `/products/view/?slug=${slug}`, { waitUntil: 'load' });
    await page.waitForSelector('#p-state.empty', { timeout: 20000 });
    ok(T('deactivated product disappears from the public site'), true);
    await page.goto(BASE + '/admin/#/products'); await shot('admin-products');
    await page.click('text=Sign out');
    await page.waitForSelector('#a-email');
    ok(T('sign out returns to login'), true);
  }

  ok(T('no unexpected console errors'), errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close();
for (const r of results) console.log(r.join(' | '));
const fails = results.filter((r) => r[0] === 'FAIL').length;
const skipped = results.filter((r) => r[0] === 'SKIP').length;
console.log(`${fails} failures, ${skipped} skipped, of ${results.length}${hasAdmin ? '' : '  (admin checks skipped: no E2E_ADMIN_* credentials in the environment)'}`);
process.exit(fails ? 1 : 0);
