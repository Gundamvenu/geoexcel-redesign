// Prefix a site-relative path with the configured base so links also work on GitHub Pages sub-paths.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (path = ''): string => `${base}/${path.replace(/^\//, '')}`;
export const stripBase = (pathname: string): string => (base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname) || '/';
