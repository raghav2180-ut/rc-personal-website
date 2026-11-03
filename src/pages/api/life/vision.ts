import { UserError } from '../../../lib/life/actions';
import { setVisionNow } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  if (form.person() !== 'Raghav') throw new UserError('This part of the tracker is Raghav’s.');
  await setVisionNow(form.int('row'), form.str('value', 60));
  return 'measure';
});
