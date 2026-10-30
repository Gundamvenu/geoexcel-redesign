// Pure helpers for product specs. No JSON import, so they are safe to bundle in browser scripts.

export type SpecProduct = { category: string; specs: Record<string, unknown> };
export type EnquiryOption = { key: string; label: string; values: string[] };

/** jsonb values can be anything an admin typed; the UI only ever shows strings. */
export const specStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();
export const specMap = (p: SpecProduct): Record<string, string> =>
  Object.fromEntries(Object.entries(p.specs ?? {}).map(([k, v]) => [k, specStr(v)]).filter(([, v]) => v));

// jsonb does not keep key order, so spec sheets are ordered here: the sensible rows first, the rest A-Z.
const SPEC_ORDER = ['Variety', 'Grade', 'Form', 'Region', 'Country of origin', 'Colour', 'Polish', 'Texture', 'Broken', 'Moisture', 'Purity', 'Extraneous matter', 'Light berries', 'Baby cloves', 'Total ash', 'Acid-insoluble ash', 'Sizes', 'Botanical name', 'Extraction method', 'Pack size', 'Packaging type', 'Storage', 'Shelf life', 'Ingredients', 'Allergen info', 'Features', 'Speciality', 'HS code', 'Specification note'];
export function orderedSpecs(p: SpecProduct): [string, string][] {
  const m = specMap(p);
  const rank = (k: string) => { const i = SPEC_ORDER.indexOf(k); return i === -1 ? SPEC_ORDER.length : i; };
  return Object.entries(m).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The few specs on a listing card. */
export const cardSpecs = (p: SpecProduct): [string, string][] => {
  const m = specMap(p);
  return ['Pack size', 'Region', 'Moisture', 'HS code', 'Shelf life'].filter((k) => m[k]).slice(0, 3).map((k) => [k, m[k]]);
};

const clean = (xs: string[]) => [...new Set(xs.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];

// "1& 30Kgs" -> ["1 Kgs", "30 Kgs"]; "20 Kg, 10 Kg" -> as listed
function splitPacks(v: string): string[] {
  const parts = v.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean);
  const unit = (parts.map((p) => p.match(/[a-z]+$/i)?.[0]).find(Boolean) as string | undefined) ?? '';
  return clean(parts.map((p) => (/^\d+(\.\d+)?$/.test(p.trim()) && unit ? `${p.trim()} ${unit}` : p)));
}

/** Choices offered per product in the quote form, derived from that product's own specs. */
export function enquiryOptions(p: SpecProduct): EnquiryOption[] {
  const s = specMap(p);
  const out: EnquiryOption[] = [];
  if (s['Pack size']) out.push({ key: 'pack', label: 'Pack size', values: splitPacks(s['Pack size']) });
  if (s['Packaging type']) out.push({ key: 'packaging', label: 'Packaging type', values: clean(s['Packaging type'].split(/,|&/)) });
  if (s['Sizes']) out.push({ key: 'size', label: 'Size', values: clean(s['Sizes'].split('|')) });
  if (s['Grade'] && /[,/]/.test(s['Grade'])) out.push({ key: 'grade', label: 'Grade', values: clean(s['Grade'].split(/[,/]/)) });
  if (s['Form'] && s['Form'].includes('/')) out.push({ key: 'form', label: 'Form', values: clean(s['Form'].split('/')) });
  if (s['Colour'] && /,/.test(s['Colour']) && /spice/i.test(p.category)) out.push({ key: 'colour', label: 'Colour', values: clean(s['Colour'].split(',')) });
  return out.filter((o) => o.values.length > 1);
}

/** Fixed facts shown beside a product in the quote form: three distinguishing ones plus the HS code. */
export function enquiryFacts(p: SpecProduct): [string, string][] {
  const s = specMap(p);
  const pick = (ks: string[]) => ks.filter((k) => s[k]).map((k) => [k, s[k]] as [string, string]);
  return [...pick(['Variety', 'Region', 'Moisture', 'Broken', 'Botanical name', 'Storage', 'Shelf life']).slice(0, 3), ...pick(['HS code'])];
}

// URL keys for categories. The four original ones keep the short keys used by existing links (?c=rice).
const KEYS: Record<string, string> = { Rice: 'rice', 'Whole spices': 'spices', 'IQF frozen vegetables & potato': 'iqf', 'Edible oils & ghee': 'oils' };
const COLORS: Record<string, string> = { Rice: '#F7941D', 'Whole spices': '#E31E2B', 'IQF frozen vegetables & potato': '#5ECBB6', 'Edible oils & ghee': '#50B957' };
export const categoryKey = (name: string): string => KEYS[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const categoryColor = (name: string): string => COLORS[name] ?? '#0E2235';
