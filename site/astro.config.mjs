// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

// SITE_URL and BASE_PATH are set at build time by the deploy target (see README).
const site = process.env.SITE_URL || 'https://geoexcel-redesign.example';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [
    preact(),
    // The admin area and the client-rendered product view are not for search engines.
    sitemap({ filter: (page) => !page.includes('/admin/') && !page.includes('/products/view/') }),
  ],
  build: { format: 'directory' },
});
