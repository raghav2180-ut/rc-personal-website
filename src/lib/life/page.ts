import type { AstroGlobal } from 'astro';
import { isPerson, personForEmail, type Person } from './env';

const SAVED: Record<string, string> = {
  checkin: 'Check-in saved to the sheet',
  'task-done': 'Marked done',
  'task-undone': 'Marked not done',
  'task-added': 'Task added',
  status: 'Status updated',
  'goals-added': 'Goals added',
  nothing: 'Nothing new to add',
  review: 'Review saved: Goals, Scores and next week',
  month: 'Monthly log saved',
  measure: 'Saved',
  'migraine-attack': 'Attack saved to the diary',
  'migraine-clear': 'Marked as a clear day',
  'migraine-deleted': 'Entry deleted',
  'migraine-profile': 'Details saved',
};

export interface Flash {
  kind: 'ok' | 'err';
  text: string;
}

/** Who is signed in, whose data is on screen, and any message from the last save. */
export function lifeContext(Astro: AstroGlobal) {
  const session = Astro.locals.session!;
  const me: Person = personForEmail(session.email);
  const asked = Astro.url.searchParams.get('p');
  const person: Person = isPerson(asked) ? asked : me;

  const saved = Astro.url.searchParams.get('saved');
  const error = Astro.url.searchParams.get('error');
  const flash: Flash | null = error
    ? { kind: 'err', text: error.slice(0, 200) }
    : saved && SAVED[saved]
      ? { kind: 'ok', text: SAVED[saved] }
      : null;

  /** Keep the chosen person when moving between screens. */
  const href = (path: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (person !== me) params.set('p', person);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  /** Where a form should send the browser back to. */
  const here = Astro.url.pathname + (() => {
    const params = new URLSearchParams(Astro.url.search);
    params.delete('saved');
    params.delete('error');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  })();

  return { session, me, person, flash, href, here };
}

export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 400);
}
