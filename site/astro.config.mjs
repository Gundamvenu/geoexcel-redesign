// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE and BASE_PATH are set at build time by the deploy target (see README).
const site = process.env.SITE_URL || 'https://geoexcel-redesign.example';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
