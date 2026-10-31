import { UserError } from '../../../lib/life/actions';
import type { Form } from '../../../lib/life/http';
import { formRoute } from '../../../lib/life/http';
import {
  deleteDay,
  DOSES,
  FACTORS,
  FEEL,
  FOOD_TAGS,
  LOCATIONS,
  MED_DEFAULT,
  PROFILE_FIELDS,
  QUALITY,
  RELIEF,
  saveDay,
  saveProfile,
  SYMPTOMS,
  WATER,
  type DayInput,
  type Profile,
} from '../../../lib/life/migraine';

export const prerender = false;

const time = (form: Form, name: string) => {
  const v = form.str(name, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '';
};
/** Only keep options the form offers. */
const pick = (form: Form, name: string, options: string[]) => form.all(name).filter((v) => options.includes(v));
const one = (form: Form, name: string, options: string[]) => {
  const v = form.str(name, 60);
  return options.includes(v) ? v : '';
};
const range = (form: Form, name: string, lo: number, hi: number) => {
  const n = form.num(name);
  return n == null ? null : Math.min(hi, Math.max(lo, Math.round(n * 10) / 10));
};

function readAttack(form: Form, date: string): DayInput {
  const ongoing = form.str('ongoing', 3) === 'yes';
  const medTaken = form.str('medTaken', 3) === 'yes';
  const medChoice = form.str('medName', 60);
  const medOther = form.str('medOther', 80).trim();
  const pain = range(form, 'pain', 0, 10);
  if (pain == null) throw new UserError('Pick how bad the pain was, 0 to 10.');
  return {
    date,
    headache: true,
    start: time(form, 'start'),
    end: ongoing ? '' : time(form, 'end'),
    ongoing,
    pain,
    location: pick(form, 'location', LOCATIONS),
    feel: pick(form, 'feel', FEEL),
    symptoms: pick(form, 'symptoms', SYMPTOMS),
    medTaken,
    medName: medTaken ? (medChoice === 'Other' ? medOther || 'Other' : MED_DEFAULT) : '',
    dose: medTaken ? one(form, 'dose', DOSES) : '',
    medTime: medTaken ? time(form, 'medTime') : '',
    relief: medTaken ? one(form, 'relief', RELIEF) : '',
    bed: time(form, 'bed'),
    wake: time(form, 'wake'),
    quality: one(form, 'quality', QUALITY),
    food: form.str('food', 2000).trim(),
    foodTags: pick(form, 'foodTags', FOOD_TAGS),
    water: one(form, 'water', WATER),
    caffeine: range(form, 'caffeine', 0, 20),
    stress: range(form, 'stress', 1, 5),
    screen: range(form, 'screen', 0, 24),
    factors: pick(form, 'factors', FACTORS),
    notes: form.str('notes', 4000).trim(),
  };
}

const CLEAR: Omit<DayInput, 'date'> = {
  headache: false,
  start: '',
  end: '',
  ongoing: false,
  pain: null,
  location: [],
  feel: [],
  symptoms: [],
  medTaken: false,
  medName: '',
  dose: '',
  medTime: '',
  relief: '',
  bed: '',
  wake: '',
  quality: '',
  food: '',
  foodTags: [],
  water: '',
  caffeine: null,
  stress: null,
  screen: null,
  factors: [],
  notes: '',
};

export const POST = formRoute(async (form) => {
  const intent = form.str('intent', 20);

  if (intent === 'profile') {
    const p = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, form.str(f.key, 300).trim()])) as Profile;
    await saveProfile(p);
    return 'migraine-profile';
  }

  const date = form.date('date');
  if (intent === 'attack') {
    await saveDay(readAttack(form, date));
    return 'migraine-attack';
  }
  if (intent === 'clear') {
    await saveDay({ date, ...CLEAR }, { replaceAttack: form.str('replace', 3) === 'yes' });
    return 'migraine-clear';
  }
  if (intent === 'delete') {
    await deleteDay(date);
    return 'migraine-deleted';
  }
  throw new UserError('Something in the form was off. Refresh and try again.');
});
