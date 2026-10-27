import { setVisionNow } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  await setVisionNow(form.int('row'), form.str('value', 60));
  return 'measure';
});
