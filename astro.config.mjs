import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://chopraraghav.com',
  // Public pages stay static. The private Life Tracker (/life, /api/*) opts out
  // with `export const prerender = false` and runs as a Vercel function.
  output: 'static',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/life') && !page.includes('/api/'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  image: { responsiveStyles: true },
});
