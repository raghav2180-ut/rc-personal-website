import { UserError } from '../../../lib/life/actions';
import { addGoals, setCurrent, toggleMilestone, type Kind, type NewGoal } from '../../../lib/life/goals';
import { formRoute } from '../../../lib/life/http';

export const prerender = false;

export const POST = formRoute(async (form) => {
  const person = form.person();
  switch (form.str('action', 20)) {
    case 'current': {
      const raw = form.str('value', 20).replace(/[₹,\sL]/gi, '');
      const value = raw === '' ? null : Number(raw);
      if (value !== null && !Number.isFinite(value)) throw new UserError('Enter a number.');
      await setCurrent(person, form.int('row'), form.str('goal', 500), value);
      return 'goal-current';
    }
    case 'milestone':
      await toggleMilestone(person, form.int('row'), form.str('goal', 500), Number(form.str('i', 3)));
      return 'milestone';
    case 'add': {
      const kind = form.str('kind', 2) as Kind;
      if (kind !== 'FY' && kind !== 'Q') throw new UserError('Unknown period. Refresh and try again.');
      const q = kind === 'Q' ? Number(form.str('q', 1)) : null;
      const areas = form.all('area');
      const owners = form.all('owner');
      const baselines = form.all('baseline');
      const targets = form.all('target');
      const steps = form.all('milestones');
      const toNum = (v: string | undefined, label: string) => {
        const t = (v ?? '').replace(/[₹,\sL]/gi, '');
        if (t === '') return null;
        const n = Number(t);
        if (!Number.isFinite(n)) throw new UserError(`${label} should be a number.`);
        return n;
      };
      const goals: NewGoal[] = form.all('goal').map((goal, i) => ({
        area: (areas[i] ?? '').slice(0, 60).trim(),
        owner: (owners[i] ?? '').slice(0, 60).trim(),
        goal: goal.slice(0, 300).trim(),
        baseline: toNum(baselines[i], 'The start number'),
        target: toNum(targets[i], 'The target'),
        milestones: (steps[i] ?? '').slice(0, 1000).trim(),
      }));
      await addGoals(person, { kind, fy: form.str('fy', 7), q }, goals);
      return 'period-goals';
    }
    default:
      throw new UserError('Unknown action.');
  }
});
