import { saveMonth } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  await saveMonth({
    key: form.str('month', 7),
    movements: form.str('movements', 20000),
    notes: form.str('notes', 2000),
    revenue: form.str('revenue', 20),
    fuel: form.str('fuel', 20),
    ump: form.str('ump', 20),
    colleges: form.str('colleges', 20),
    tech: form.str('tech', 20),
  });
  return 'month';
});
