import { saveCheckIn } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  await saveCheckIn({
    date: form.date('date'),
    person: form.person(),
    vision: form.opt('vision'),
    walk: form.opt('walk'),
    deep: form.opt('deep'),
    night: form.opt('night'),
    displaced: form.opt('displaced'),
    win: form.str('win', 2000),
    worry: form.str('worry', 2000),
  });
  return 'checkin';
});
