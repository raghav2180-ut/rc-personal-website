import type { AstroGlobal } from 'astro';
import { personForEmail, type Person } from './env';

const SAVED: Record<string, string> = {
  checkin: 'Check-in saved to the sheet',
  'task-done': 'Marked done',
  'task-undone': 'Marked not done',
  'task-partial': 'Marked partly done',
  'task-notdone': 'Marked not done',
  'task-cleared': 'Cleared',
  'task-added': 'Task added',
  'card-added': 'Card added',
  'card-saved': 'Card saved',
  'card-moved': 'Card moved',
  'card-archived': 'Card archived',
  'card-restored': 'Card restored',
  'card-deleted': 'Card deleted',
  checklist: 'Checklist saved',
  'item-toggled': 'Checklist updated',
  link: 'Links saved',
  comment: 'Comment saved',
  'comment-deleted': 'Comment deleted',
  'top3-added': 'Added to today’s Top 3',
  'top3-bonus': 'Added to today’s Top 3 as a bonus task',
  'task-edited': 'Task updated',
  status: 'Status updated',
  'goals-added': 'Goals added',
  'goal-current': 'Number updated',
  milestone: 'Step updated',
  'period-goals': 'Goals saved to the sheet',
  nothing: 'Nothing new to add',
  review: 'Review saved: Goals, Scores and next week',
  'review-1': 'Step 1 saved: look back',
  'review-2': 'Step 2 saved: goals closed',
  'review-3': 'Step 3 saved: vision check',
  'review-4': 'Step 4 saved: numbers',
  'review-5': 'Review complete. Next week is planned',
  month: 'Monthly log saved',
  measure: 'Saved',
  'lv-added': 'Added',
  'lv-saved': 'Saved',
  'lv-done': 'Ticked off. Well done',
  'lv-undone': 'Marked not done',
  'lv-deleted': 'Deleted',
  'lv-moved': 'Moved',
  'lv-vision': 'Vision 2029 saved',
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
  // Each person only ever sees their own tracker (the Today screen also shows the
  // other person's Top 3, read-only).
  const person: Person = me;
  const partner: Person = me === 'Raghav' ? 'Kajol' : 'Raghav';

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

  return { session, me, person, partner, flash, href, here };
}

export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 400);
}
