import { saveReview, SCORE_AREAS } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const numbers = new Map<number, number>();
  for (const key of form.all('numberRow')) {
    const row = Number(key);
    const value = form.num(`number-${row}`);
    if (Number.isInteger(row) && value !== null) numbers.set(row, value);
  }
  const fys = form.all('fy');
  await saveReview({
    person: form.person(),
    week: form.date('week'),
    numbers,
    scores: SCORE_AREAS.map((_, i) => form.num(`score-${i}`)),
    slipped: form.str('slipped', 3000),
    next: form.all('goal').map((goal, i) => ({ goal: goal.slice(0, 300), fy: fys[i] ?? '' })),
  });
  return 'review';
});
