import { addWeeklyGoals, setWeeklyStatus } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  const week = form.date('week');
  if (form.str('action') === 'add') {
    const fys = form.all('fy');
    const goals = form.all('goal').map((goal, i) => ({ goal, fy: fys[i] ?? '' }));
    const added = await addWeeklyGoals(person, week, goals);
    return added ? 'goals-added' : 'nothing';
  }
  await setWeeklyStatus({ row: form.int('row'), week, person, status: form.str('status', 40) });
  return 'status';
});
