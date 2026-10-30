import raw from './catalog.json';

export type Product = { id: string; category: CategoryId; name: string; about: string; specs: Record<string, string>; note: string };
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
