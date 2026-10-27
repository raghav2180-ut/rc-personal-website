import { addTop3, setTop3Done } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  const date = form.date('date');
  if (form.str('action') === 'add') {
    await addTop3({ date, person, task: form.str('task', 300), fy: form.str('fy', 40) });
    return 'task-added';
  }
  const done = form.str('done') === 'Yes' ? 'Yes' : 'No';
  await setTop3Done({ row: form.int('row'), date, person, done });
  return done === 'Yes' ? 'task-done' : 'task-undone';
});
