/**
 * Server-only settings for the Life Tracker.
 * Read at request time from process.env (Vercel), falling back to Vite's
 * import.meta.env so a local `.env` file works with `astro dev`.
 * Never import this file from client-side code.
 */
export function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess ?? fromVite;
  return value && value.trim() !== '' ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing environment variable ${name}. Add it in Vercel → Settings → Environment Variables.`);
  return value;
}

/** Emails that may sign in, lower-cased. */
export function allowedEmails(): string[] {
  return (env('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** The two people the tracker knows about. */
export const PEOPLE = ['Raghav', 'Kajol'] as const;
export type Person = (typeof PEOPLE)[number];

/** Map a signed-in email to the person name used in the sheet. */
export function personForEmail(email: string): Person {
  const local = email.toLowerCase().split('@')[0];
  if (local.startsWith('kajol')) return 'Kajol';
  return 'Raghav';
}

export function isPerson(value: unknown): value is Person {
  return typeof value === 'string' && (PEOPLE as readonly string[]).includes(value);
}
