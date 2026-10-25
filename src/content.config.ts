import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Rounds: the chapters of the story, told like rounds in an interview experience.
 * One Markdown file per round in src/content/rounds/. `order` sets the sequence.
 */
const rounds = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/rounds' }),
  schema: ({ image }) =>
    z.object({
      order: z.number(),
      when: z.string(),            // shown in the round's label, e.g. "2013" or "Oct 2024"
      title: z.string(),
      asked: z.string(),           // what this round tested
      tip: z.string().optional(),  // handwritten note in the margin
      photo: image().optional(),
      photoAlt: z.string().optional(),
      caption: z.string().optional(),
    }),
});

/**
 * Writing: selected LinkedIn posts, lightly edited for the web.
 * One Markdown file per post in src/content/writing/.
 */
const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    when: z.string(),         // display date, e.g. "Jan 2026"
    order: z.number(),        // higher = newer, used for sorting
    summary: z.string(),
    originallyOn: z.string().default('LinkedIn'),
  }),
});

export const collections = { rounds, writing };
