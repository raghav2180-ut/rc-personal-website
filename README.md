# rc-personal-website

The source for **chopraraghav.com**, Raghav Chopra's personal website. The site tells his story the way UnsaidTalks publishes interview experiences: as rounds, with tips for juniors.

Built with **Astro 5** (static HTML), **Tailwind CSS 4**, and Markdown content. Deploys to **Vercel**.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs static files to dist/
npm run preview  # serves dist/
```

Node 20 or newer.

## Where things live

| What | Where |
|---|---|
| The story, one file per round | `src/content/rounds/*.md` (`order` sets the sequence) |
| Writing posts | `src/content/writing/*.md` (`order`: higher = newer) |
| Everything else on the homepage (stats, tips, testimonials, programs, colleges, people, team carousel, contact) | `src/data/site.ts` |
| Photos | `src/assets/photos/` (Astro turns them into AVIF/WebP at build time) |
| Colours and fonts | `src/styles/global.css` (`@theme` block) |
| Page shell, SEO, structured data | `src/layouts/Layout.astro` |
| Homepage layout | `src/pages/index.astro` |
| Link preview image | `public/og.jpg` (1200×630) |

## Common edits

- **Add a writing post:** copy any file in `src/content/writing/`, change the front matter (`title`, `when`, `order`, `summary`) and the text. It appears on `/writing/` and, if newest, on the homepage.
- **Update a number:** edit `stats` in `src/data/site.ts`. Keep the date in the label honest.
- **Swap a photo:** put the new file in `src/assets/photos/` with the same name, or change the import at the top of `src/data/site.ts`. Always write a real `alt` description.
- **Add a round:** add a Markdown file in `src/content/rounds/` with the next `order`, and update "Rounds" in `factTable` in `src/data/site.ts`.

## Deploy (Vercel)

1. Import this repo in Vercel. It detects Astro automatically (build `npm run build`, output `dist`).
2. In Vercel → Project → Domains, add `chopraraghav.com` and `www.chopraraghav.com`, then set the DNS records Vercel shows at the domain registrar.
3. Every push to `main` deploys; every pull request gets a preview link.

Optional: turn on Vercel Web Analytics in the project settings.

## Design notes

- Direction "Interview Experience": white paper cards on a cool desk, ballpoint-blue handwritten notes, an orange "Selected" stamp.
- Fonts (self-hosted via Fontsource): Bricolage Grotesque (headings), Literata (body), JetBrains Mono (labels), Kalam (handwritten notes).
- The "U" hand sign in the photos stands for UnsaidTalks.
- Only professional details about mentors appear on the site. Never add contact or bank details from the mentor sheet.
