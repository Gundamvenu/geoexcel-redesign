// notify-quotation: called by the database (pg_net trigger on quotations INSERT) after a quotation commits.
// Sends two emails through Resend: one to the admin, one confirmation to the customer.
//
// Secrets (set with `supabase secrets set`, never committed):
//   RESEND_API_KEY      Resend API key
//   ADMIN_NOTIFY_EMAIL  where new-quotation alerts go
//   MAIL_FROM           optional sender, e.g. "Geo Excel <quotes@your-domain>"; defaults to Resend's sandbox sender
//   SITE_URL            public site URL, used for the admin link, e.g. https://gundamvenu.github.io/geoexcel-redesign
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform; this function never logs them.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_NOTIFY_EMAIL = Deno.env.get('ADMIN_NOTIFY_EMAIL') ?? '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'Geo Excel <onboarding@resend.dev>';
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escape text for safe inclusion in HTML. Every user-supplied value goes through this. */
const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]!));

/** Header values (subject, names) must not contain line breaks. */
const oneLine = (v: unknown): string => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);

type Item = { product_name: string | null; quantity: number | null; note: string | null; products: { name: string } | null };
type Quote = {
  id: string;
  reference: string;
  message: string | null;
  created_at: string;
  customers: { name: string; company: string | null; email: string; phone: string | null; country: string | null; city: string | null };
  quotation_items: Item[];
};

const itemLabel = (i: Item) => i.products?.name ?? i.product_name ?? 'Product not specified';

function itemsHtml(items: Item[]): string {
  if (!items.length) return '<p><em>No specific products selected.</em></p>';
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 10px;border:1px solid #d8cfbb">${esc(itemLabel(i))}</td>` +
        `<td style="padding:6px 10px;border:1px solid #d8cfbb">${i.quantity ?? ''}</td>` +
        `<td style="padding:6px 10px;border:1px solid #d8cfbb">${esc(i.note ?? '')}</td></tr>`,
    )
    .join('');
  return (
    '<table style="border-collapse:collapse;font-size:14px"><thead><tr>' +
    ['Product', 'Qty', 'Details'].map((h) => `<th style="text-align:left;padding:6px 10px;border:1px solid #d8cfbb;background:#ede6d6">${h}</th>`).join('') +
    `</tr></thead><tbody>${rows}</tbody></table>`
  );
}

function itemsText(items: Item[]): string {
  if (!items.length) return '  (no specific products selected)';
  return items.map((i) => `  - ${itemLabel(i)}${i.quantity ? ` x ${i.quantity}` : ''}${i.note ? ` (${i.note})` : ''}`).join('\n');
}

function adminEmail(q: Quote) {
  const c = q.customers;
  const link = SITE_URL ? `${SITE_URL}/admin/#/quotations/${q.id}` : '';
  const subject = oneLine(`New quotation request ${q.reference} from ${c.company || c.name}`);
  const html =
    `<div style="font-family:Arial,sans-serif;color:#0e2235;max-width:640px">` +
    `<h2 style="margin:0 0 8px">New quotation request ${esc(q.reference)}</h2>` +
    `<p style="margin:0 0 16px;color:#55626e">Received ${esc(new Date(q.created_at).toUTCString())}</p>` +
    `<table style="font-size:14px;margin-bottom:16px">` +
    `<tr><td style="padding:2px 12px 2px 0;color:#55626e">Name</td><td>${esc(c.name)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#55626e">Company</td><td>${esc(c.company ?? '')}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#55626e">Email</td><td>${esc(c.email)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#55626e">Phone</td><td>${esc(c.phone ?? '')}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#55626e">Destination</td><td>${esc([c.city, c.country].filter(Boolean).join(', '))}</td></tr>` +
    `</table>` +
    `<h3 style="margin:0 0 6px">Requested products</h3>${itemsHtml(q.quotation_items)}` +
    (q.message ? `<h3 style="margin:16px 0 6px">Message</h3><p style="white-space:pre-wrap">${esc(q.message)}</p>` : '') +
    (link ? `<p style="margin-top:20px"><a href="${esc(link)}" style="background:#0e2235;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open in admin</a></p>` : '') +
    `</div>`;
  const text =
    `New quotation request ${q.reference}\n\nName: ${c.name}\nCompany: ${c.company ?? ''}\nEmail: ${c.email}\nPhone: ${c.phone ?? ''}\n` +
    `Destination: ${[c.city, c.country].filter(Boolean).join(', ')}\n\nProducts:\n${itemsText(q.quotation_items)}\n` +
    (q.message ? `\nMessage:\n${q.message}\n` : '') +
    (link ? `\nOpen in admin: ${link}\n` : '');
  return { subject, html, text };
}

function customerEmail(q: Quote) {
  const c = q.customers;
  const subject = oneLine(`We received your quotation request ${q.reference}`);
  const html =
    `<div style="font-family:Arial,sans-serif;color:#0e2235;max-width:640px">` +
    `<h2 style="margin:0 0 8px">Thank you, ${esc(c.name)}</h2>` +
    `<p>We have received your quotation request. Please quote this reference in any follow-up:</p>` +
    `<p style="font-size:22px;font-weight:bold;letter-spacing:.04em">${esc(q.reference)}</p>` +
    `<h3 style="margin:16px 0 6px">What you asked for</h3>${itemsHtml(q.quotation_items)}` +
    (q.message ? `<p style="white-space:pre-wrap;margin-top:12px">${esc(q.message)}</p>` : '') +
    `<p style="color:#55626e;margin-top:20px;font-size:13px">This is an automated confirmation. It is not a price quotation.</p>` +
    `</div>`;
  const text =
    `Thank you, ${c.name}.\n\nWe have received your quotation request. Please quote this reference in any follow-up: ${q.reference}\n\n` +
    `What you asked for:\n${itemsText(q.quotation_items)}\n` +
    (q.message ? `\n${q.message}\n` : '') +
    `\nThis is an automated confirmation. It is not a price quotation.\n`;
  return { subject, html, text };
}

async function sendEmail(to: string, mail: { subject: string; html: string; text: string }, replyTo?: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject: mail.subject, html: mail.html, text: mail.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Only the database may call this: it sends a shared secret that lives in private.app_secrets.
  const secret = req.headers.get('x-webhook-secret') ?? '';
  const { data: ok } = await admin.rpc('verify_notify_secret', { p_secret: secret });
  if (ok !== true) return json({ error: 'unauthorized' }, 401);

  let id = '';
  try {
    id = String((await req.json())?.quotation_id ?? '');
  } catch { /* fall through */ }
  if (!UUID.test(id)) return json({ error: 'bad_request' }, 400);

  if (!RESEND_API_KEY || !ADMIN_NOTIFY_EMAIL) {
    await admin.from('quotations').update({ notify_error: 'Email is not configured (RESEND_API_KEY / ADMIN_NOTIFY_EMAIL missing)' }).eq('id', id);
    console.log(JSON.stringify({ event: 'notify_skipped', quotation_id: id, reason: 'not_configured' }));
    return json({ sent: false, reason: 'not_configured' });
  }

  // Claim the quotation so a replayed call can never send the emails twice.
  const { data: claimed } = await admin
    .from('quotations')
    .update({ notified_at: new Date().toISOString(), notify_error: null })
    .eq('id', id)
    .is('notified_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return json({ sent: false, reason: 'already_handled' });

  const { data: q, error } = await admin
    .from('quotations')
    .select('id, reference, message, created_at, customers(name, company, email, phone, country, city), quotation_items(product_name, quantity, note, products(name))')
    .eq('id', id)
    .single<Quote>();
  if (error || !q) {
    await admin.from('quotations').update({ notified_at: null, notify_error: 'Could not load quotation' }).eq('id', id);
    console.error(JSON.stringify({ event: 'load_failed', quotation_id: id, message: error?.message }));
    return json({ error: 'not_found' }, 404);
  }

  const problems: string[] = [];
  let adminSent = false;
  try {
    await sendEmail(ADMIN_NOTIFY_EMAIL, adminEmail(q), q.customers.email);
    adminSent = true;
  } catch (e) {
    problems.push(`admin email: ${(e as Error).message}`);
  }
  try {
    await sendEmail(q.customers.email, customerEmail(q), ADMIN_NOTIFY_EMAIL);
  } catch (e) {
    problems.push(`customer email: ${(e as Error).message}`);
  }

  await admin
    .from('quotations')
    .update({ notified_at: adminSent ? new Date().toISOString() : null, notify_error: problems.length ? problems.join(' | ').slice(0, 900) : null })
    .eq('id', id);

  console.log(JSON.stringify({ event: 'notify_done', reference: q.reference, admin_sent: adminSent, problems: problems.length }));
  return json({ sent: adminSent, problems: problems.length });
});
