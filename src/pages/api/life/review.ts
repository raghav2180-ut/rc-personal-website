import { UserError } from '../../../lib/life/actions';
import { formRoute } from '../../../lib/life/http';
import {
  AREAS,
  NUMBERS,
  saveCloseGoals,
  saveLookBack,
  saveNumbers,
  savePlan,
  saveVisionCheck,
  type PlanGoal,
} from '../../../lib/life/review';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  const week = form.date('week');
  const step = form.str('step', 2);

  switch (step) {
    case '1':
      await saveLookBack(person, week, form.str('win', 1000), form.str('worry', 1000));
      break;
    case '2':
      await saveCloseGoals(
        person,
        week,
        form.all('goalRow').map((r) => ({
          row: Number(r),
          result: form.str(`result-${r}`, 40),
          why: form.str(`why-${r}`, 60),
          next: form.str(`next-${r}`, 20),
          handTo: form.str(`hand-${r}`, 60),
        })),
      );
      break;
    case '3':
      await saveVisionCheck(
        person,
        week,
        AREAS.map((_, i) => form.num(`score-${i}`)),
        AREAS.map((_, i) => form.str(`closer-${i}`, 500)),
      );
      break;
    case '4': {
      const numbers = Object.fromEntries(NUMBERS.map((n) => [n.key, { value: form.str(`num-${n.key}`, 20), note: form.str(`note-${n.key}`, 500) }]));
      await saveNumbers(person, week, numbers);
      break;
    }
    case '5': {
      const goals: PlanGoal[] = form.all('erow').map((r) => ({
        row: Number(r),
        remove: form.str(`eremove-${r}`, 5) === 'yes',
        area: form.str(`earea-${r}`, 40),
        goal: form.str(`egoal-${r}`, 300),
        day: form.str(`eday-${r}`, 10),
        firstStep: form.str(`estep-${r}`, 300),
      }));
      const areas = form.all('area');
      const days = form.all('day');
      const steps = form.all('firstStep');
      form.all('goal').forEach((goal, i) => goals.push({ area: areas[i] ?? '', goal: goal.slice(0, 300), day: days[i] ?? '', firstStep: (steps[i] ?? '').slice(0, 300) }));
      await savePlan(person, week, {
        one: form.str('one', 500),
        sayNo: form.str('sayNo', 500),
        lesson: form.str('lesson', 1000),
        future: form.str('future', 1000),
        energy: form.num('energy'),
        workOnly: form.str('workOnly', 5) === 'yes',
        goals,
      });
      break;
    }
    default:
      throw new UserError('Unknown review step.');
  }
  return `review-${step}`;
});
