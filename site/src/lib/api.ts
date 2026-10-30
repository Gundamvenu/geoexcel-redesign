// Public (anonymous) client for the Supabase REST API. Deliberately tiny: plain fetch, no supabase-js,
// so public pages stay light. Only the project URL and the publishable key are used (build-time env).
// The service_role key never appears anywhere in this repo or in the browser.
import { u } from '../data/url';

const URL_ = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const apiConfigured = Boolean(URL_ && KEY);

export type DbProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  short_description: string | null;
  specs: Record<string, unknown>;
  unit: string | null;
  price_note: string | null;
  image_url: string | null;
};

export type ApiErrorKind = 'invalid' | 'rate' | 'offline' | 'server' | 'config';
export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string) {
    super(message);
  }
}

const COLUMNS = 'id,name,slug,category,short_description,specs,unit,price_note,image_url';

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!apiConfigured) throw new ApiError('config', 'The product service is not configured.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    return await fetch(`${URL_}${path}`, { ...init, signal: ctrl.signal, headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  } catch {
    throw new ApiError('offline', 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

// Same order the site has always shown. Unknown (admin-added) categories follow, A-Z.
const CATEGORY_ORDER = ['Rice', 'Whole spices', 'IQF frozen vegetables & potato', 'Edible oils & ghee'];
export const categoryRank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i; };

export async function fetchProducts(): Promise<DbProduct[]> {
  const res = await request(`/rest/v1/products?select=${COLUMNS}&is_active=eq.true&order=name.asc`);
  if (!res.ok) throw new ApiError('server', `Products could not be loaded (${res.status}).`);
  const rows = (await res.json()) as DbProduct[];
  return rows.sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** null = no active product with this slug (never existed, or switched off by an admin). */
export async function fetchProductBySlug(slug: string): Promise<DbProduct | null> {
  const res = await request(`/rest/v1/products?select=${COLUMNS}&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`);
  if (!res.ok) throw new ApiError('server', `Product could not be loaded (${res.status}).`);
  const rows = (await res.json()) as DbProduct[];
  return rows[0] ?? null;
}

export const productImage = (p: Pick<DbProduct, 'image_url'>): string | null =>
  !p.image_url ? null : /^https?:\/\//i.test(p.image_url) ? p.image_url : u(p.image_url);

export type QuotationItemInput = { product_id: string | null; product_name?: string | null; quantity: number | null; note: string | null };
export type QuotationInput = {
  name: string; company: string; email: string; phone: string; message: string;
  country: string; city?: string; items: QuotationItemInput[]; website: string; // `website` is the honeypot
};

/** Calls the submit_quotation RPC. Resolves to the human-readable reference, e.g. GX-2026-0001. */
export async function submitQuotation(q: QuotationInput): Promise<string> {
  const res = await request('/rest/v1/rpc/submit_quotation', {
    method: 'POST',
    body: JSON.stringify({
      p_name: q.name, p_company: q.company, p_email: q.email, p_phone: q.phone, p_message: q.message,
      p_items: q.items, p_country: q.country, p_city: q.city ?? null, p_website: q.website,
    }),
  });
  if (res.ok) return (await res.json()) as string;
  let msg = '';
  try { msg = String((await res.json())?.message ?? ''); } catch { /* not JSON */ }
  if (msg.startsWith('invalid_input:')) throw new ApiError('invalid', msg.replace('invalid_input:', '').trim());
  if (msg.startsWith('rate_limited:')) throw new ApiError('rate', msg.replace('rate_limited:', '').trim());
  throw new ApiError('server', 'We could not record your request just now.');
}
