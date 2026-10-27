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

## Private Life Tracker (`/life`)

A signed-in section for Raghav and Kajol: Today, Week (with the Saturday review), Goals, Monthly and Vision 2029, plus a phone check-in at `/life/checkin`. It reads from and writes to the **Dream Life 2029 – Tracker** Google Sheet. Public pages stay static; only `/life/*` and `/api/*` run as a Vercel function.

- **Sign-in:** Google, limited to the emails in `ALLOWED_EMAILS`. The session is a signed cookie (30 days).
- **Data:** a Google Cloud service account with Editor access to the sheet. Each screen makes one read; every write re-checks the row it changes first.
- **Settings:** see `.env.example`. Put real values in Vercel → Settings → Environment Variables only.
- **Code:** `src/lib/life/` (auth, sheets client, data shaping, writes), `src/pages/life/`, `src/pages/api/`, `src/styles/life.css`.
- **Local development without Google:** set `LIFE_MOCK_FILE` to a JSON copy of the sheet (`{"Top3": [[...], ...], ...}`) and run `npm run dev`. Keep that file outside the repo.

Sheet tabs it uses: `Top3`, `CheckIns`, `Weekly`, `Scores` (column I holds "What slipped"), `Goals` (progress numbers in H2:J6), `Monthly`, `Vision` (text in column A; the Today → 2029 scoreboard in C1:E10).

## Design notes

- Direction "Interview Experience": white paper cards on a cool desk, ballpoint-blue handwritten notes, an orange "Selected" stamp.
- Fonts (self-hosted via Fontsource): Bricolage Grotesque (headings), Literata (body), JetBrains Mono (labels), Kalam (handwritten notes).
- The "U" hand sign in the photos stands for UnsaidTalks.
- Only professional details about mentors appear on the site. Never add contact or bank details from the mentor sheet.
