// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static site for chopraraghav.com. Deploys to Vercel as plain HTML.
export default defineConfig({
  site: 'https://chopraraghav.com',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // Photos are optimised at build time into AVIF/WebP at the sizes each layout needs.
    responsiveStyles: true,
  },
});
