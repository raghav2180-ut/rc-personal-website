import { addTop3, editTop3, setTop3Done } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';
import { isTop3Status, TOP3_SAVED, type Top3Status } from '../../../lib/life/top3-status';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  const date = form.date('date');
  if (form.str('action') === 'add') {
    await addTop3({ date, person, task: form.str('task', 300), fy: form.str('fy', 40) });
    return 'task-added';
  }
  if (form.str('action') === 'edit') {
    const raw = form.str('status', 10);
    const done = raw === 'Yes' || raw === 'No' || raw === 'Partial' ? raw : '';
    await editTop3({ row: form.int('row'), date, person, task: form.str('task', 300), fy: form.str('fy', 40), done });
    return 'task-edited';
  }
  const raw = form.str('done', 10);
  const done: Top3Status = isTop3Status(raw) ? raw : '';
  await setTop3Done({ row: form.int('row'), date, person, done });
  return TOP3_SAVED[done];
});
