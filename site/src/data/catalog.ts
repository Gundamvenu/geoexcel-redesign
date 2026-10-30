import raw from './catalog.json';

export type Product = { id: string; category: CategoryId; name: string; image: string; about: string; specs: Record<string, string>; note: string };
export type CategoryId = 'rice' | 'spices' | 'iqf' | 'oils';

export const categories = raw.categories as Record<CategoryId, { name: string; blurb: string }>;
export const products = raw.products as Product[];
export const categoryIds = Object.keys(categories) as CategoryId[];

export const catImage: Record<CategoryId | 'fashion', { src: string; alt: string }> = {
  rice: { src: 'img/rice.webp', alt: 'A pile of white and brown rice grains' },
  spices: { src: 'img/spices.webp', alt: 'Whole spices including star anise and black pepper in hexagonal trays' },
  iqf: { src: 'img/iqf.webp', alt: 'Fresh fruit and vegetables: papaya, kiwi, cabbage, broccoli, carrots' },
  oils: { src: 'img/oils.webp', alt: 'Golden oil being poured into a spoon' },
  fashion: { src: 'img/fashion.webp', alt: 'Leather bags in green and black' },
};
export const catAccent: Record<CategoryId | 'fashion', string> = { rice: '#F7941D', spices: '#E31E2B', iqf: '#5ECBB6', oils: '#50B957', fashion: '#0E2235' };

export const byCategory = (c: CategoryId) => products.filter((p) => p.category === c);
// The few specs shown on a listing card, in priority order.
export const cardSpecs = (p: Product) =>
  ['Pack size', 'Region', 'Moisture', 'HS code', 'Shelf life'].filter((k) => p.specs[k]).slice(0, 3).map((k) => [k, p.specs[k]] as const);

// ---- Per-product choices offered in the enquiry form, derived from that product's own published specs ----
export type EnquiryOption = { key: string; label: string; values: string[] };

const clean = (xs: string[]) => [...new Set(xs.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];

// "1& 30Kgs" -> ["1 Kgs", "30 Kgs"]; "20 Kg, 10 Kg" -> as listed; "1lt, 5lts & 50Lts" -> as listed
function splitPacks(v: string): string[] {
  const parts = v.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean);
  const unit = (parts.map((p) => p.match(/[a-z]+$/i)?.[0]).find(Boolean) as string | undefined) ?? '';
  return clean(parts.map((p) => (/^\d+(\.\d+)?$/.test(p.trim()) && unit ? `${p.trim()} ${unit}` : p)));
}

export function enquiryOptions(p: Product): EnquiryOption[] {
  const s = p.specs;
  const out: EnquiryOption[] = [];
  if (s['Pack size']) out.push({ key: 'pack', label: 'Pack size', values: splitPacks(s['Pack size']) });
  if (s['Packaging type']) out.push({ key: 'packaging', label: 'Packaging type', values: clean(s['Packaging type'].split(/,|&/)) });
  if (s['Sizes']) out.push({ key: 'size', label: 'Size', values: clean(s['Sizes'].split('|')) });
  if (s['Grade'] && /[,/]/.test(s['Grade'])) out.push({ key: 'grade', label: 'Grade', values: clean(s['Grade'].split(/[,/]/)) });
  if (s['Form'] && s['Form'].includes('/')) out.push({ key: 'form', label: 'Form', values: clean(s['Form'].split('/')) });
  if (s['Colour'] && /,/.test(s['Colour']) && p.category === 'spices') out.push({ key: 'colour', label: 'Colour', values: clean(s['Colour'].split(',')) });
  return out.filter((o) => o.values.length > 1);
}

// Fixed facts shown beside the product in the enquiry (same spec the product page lists).
export const enquiryFacts = (p: Product) => {
  const pick = (ks: string[]) => ks.filter((k) => p.specs[k]).map((k) => [k, p.specs[k]] as [string, string]);
  // three distinguishing facts plus the HS code, which a buyer needs for customs paperwork
  return [...pick(['Variety', 'Region', 'Moisture', 'Broken', 'Botanical name', 'Storage', 'Shelf life']).slice(0, 3), ...pick(['HS code'])];
};
