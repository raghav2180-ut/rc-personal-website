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
  // On Vercel, Astro only trusts the incoming host when it is listed here.
  // Without this every request looks like it came from "localhost", which
  // breaks the Google sign-in redirect and the same-origin check on forms.
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'chopraraghav.com' },
      { protocol: 'https', hostname: 'www.chopraraghav.com' },
      { protocol: 'https', hostname: '**.vercel.app' },
    ],
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/life') && !page.includes('/api/'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  image: { responsiveStyles: true },
});
