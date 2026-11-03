/**
 * Migraine Diary: reads and writes the "Migraine Diary" Google Sheet
 * (MIGRAINE_SHEET_ID) and works out the patterns.
 *
 * One row per day on the "Days" tab. A day is either a clear day
 * (Headache = No, nothing else filled) or an attack with the details.
 * The "Profile" tab holds the patient details shown to a doctor.
 *
 * Nothing personal lives in this file: the repo is public.
 */
import { UserError, text } from './actions';
import { addDays, cellToIso, daysBetween, monthKeyOf, todayIST } from './dates';
import { env, allowedEmails, personForEmail } from './env';
import { sheets } from './sheets';

// ------------------------------------------------------------- vocabulary ---

export const MED_DEFAULT = 'Ibujesic Plus';
export const DOSES = ['½', '1', '1½', '2'];
export const LOCATIONS = ['Left side', 'Right side', 'Both sides', 'Forehead', 'Around eyes', 'Back of head', 'Top of head', 'Neck'];
export const FEEL = ['Throbbing', 'Pressing', 'Stabbing', 'Dull ache'];
export const SYMPTOMS = ['Nausea', 'Vomiting', 'Light hurts', 'Sound hurts', 'Aura', 'Dizziness', 'Neck stiffness', 'Smells bother me'];
export const FOOD_TAGS = [
  'Skipped breakfast',
  'Skipped lunch',
  'Late dinner',
  'Long gap between meals',
  'Chai / coffee',
  'Chocolate',
  'Cheese',
  'Fried food',
  'Packaged / junk',
  'Very spicy',
  'Outside food',
  'Sweets',
];
export const FACTORS = [
  'Travel',
  'Sun / heat',
  'Exercise',
  'Alcohol',
  'Irregular routine',
  'Weather change',
  'Strong smell',
  'Long screen session',
  'Loud place',
  'Overslept',
];
export const RELIEF = ['None', 'A little', 'Mostly', 'Fully'];
export const QUALITY = ['Poor', 'Okay', 'Good'];
export const WATER = ['Low', 'Okay', 'Plenty'];
/** Painkiller days a month at which medication-overuse headache becomes a risk. */
export const MED_DAYS_LIMIT = 10;

export const PROFILE_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'sex', label: 'Sex' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'history', label: 'Headache history' },
  { key: 'usualMed', label: 'Usual medicine' },
] as const;
export type ProfileKey = (typeof PROFILE_FIELDS)[number]['key'];
export type Profile = Record<ProfileKey, string>;

// ----------------------------------------------------------------- access ---

/**
 * Who may open the diary. MIGRAINE_EMAILS if set; otherwise every allowed
 * email that belongs to Raghav. Kajol's login keeps the rest of /life.
 */
export function migraineEmails(): string[] {
  const listed = (env('MIGRAINE_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (listed.length) return listed.filter((e) => allowedEmails().includes(e));
  return allowedEmails().filter((e) => personForEmail(e) === 'Raghav');
}

export function canSeeMigraine(email: string | undefined | null): boolean {
  return !!email && migraineEmails().includes(email.toLowerCase());
}

// ------------------------------------------------------------------ types ---

export interface Day {
  row: number;
  date: string;
  headache: boolean;
  start: string; // "HH:MM"
  end: string;
  ongoing: boolean;
  pain: number | null;
  location: string[];
  feel: string[];
  symptoms: string[];
  medTaken: boolean;
  medName: string;
  dose: string;
  medTime: string;
  relief: string;
  bed: string;
  wake: string;
  quality: string;
  food: string;
  foodTags: string[];
  water: string;
  caffeine: number | null;
  stress: number | null;
  screen: number | null;
  factors: string[];
  notes: string;
}

export type DayInput = Omit<Day, 'row'>;

// ------------------------------------------------------------------ sheet ---

const DAYS_TAB = 'Days';
const PROFILE_TAB = 'Profile';
export const HEADER = [
  'Date',
  'Headache',
  'Started',
  'Ended',
  'Duration (min)',
  'Still going',
  'Pain (0-10)',
  'Where',
  'Felt like',
  'Symptoms',
  'Medicine taken',
  'Medicine',
  'Dose (tablets)',
  'Taken at',
  'Relief after 2h',
  'Went to bed',
  'Woke up',
  'Sleep (h)',
  'Sleep quality',
  'Food',
  'Food tags',
  'Water',
  'Caffeine (cups)',
  'Stress (1-5)',
  'Screen (h)',
  'Other factors',
  'Notes',
  'Updated',
];
const LAST_COL = 'AB'; // 28 columns
const DAYS_RANGE = `${DAYS_TAB}!A2:${LAST_COL}`;
const PROFILE_RANGE = `${PROFILE_TAB}!A2:B10`;

const client = () => sheets('MIGRAINE_SHEET_ID');

async function ready() {
  const s = client();
  await s.ensureTab(DAYS_TAB, HEADER);
  await s.ensureTab(PROFILE_TAB, ['Field', 'Value']);
  return s;
}

/** A cell as text, without the apostrophe that marks text in Sheets. */
const cell = (row: string[] | undefined, i: number) => (row?.[i] ?? '').toString().trim().replace(/^'/, '');
const list = (v: string) =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const num = (v: string): number | null => {
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const yes = (v: string) => /^y/i.test(v) || v.toUpperCase() === 'TRUE';

const pad = (n: number) => String(n).padStart(2, '0');

/** A time cell is either "HH:MM" text or a day fraction from the sheet. */
export function cellToTime(v: string): string {
  if (!v) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (m) return `${pad(Number(m[1]) % 24)}:${m[2]}`;
  const n = Number(v);
  if (Number.isFinite(n)) {
    const total = Math.round((n - Math.floor(n)) * 1440) % 1440;
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }
  return '';
}

export function parseDays(grid: string[][]): Day[] {
  const out: Day[] = [];
  grid.forEach((r, i) => {
    const date = cellToIso(cell(r, 0));
    if (!date) return;
    out.push({
      row: i + 2,
      date,
      headache: yes(cell(r, 1)),
      start: cellToTime(cell(r, 2)),
      end: cellToTime(cell(r, 3)),
      ongoing: yes(cell(r, 5)),
      pain: num(cell(r, 6)),
      location: list(cell(r, 7)),
      feel: list(cell(r, 8)),
      symptoms: list(cell(r, 9)),
      medTaken: yes(cell(r, 10)),
      medName: cell(r, 11),
      dose: cell(r, 12),
      medTime: cellToTime(cell(r, 13)),
      relief: cell(r, 14),
      bed: cellToTime(cell(r, 15)),
      wake: cellToTime(cell(r, 16)),
      quality: cell(r, 18),
      food: cell(r, 19),
      foodTags: list(cell(r, 20)),
      water: cell(r, 21),
      caffeine: num(cell(r, 22)),
      stress: num(cell(r, 23)),
      screen: num(cell(r, 24)),
      factors: list(cell(r, 25)),
      notes: cell(r, 26),
    });
  });
  // One row per date; if a date appears twice, the lower row wins.
  const byDate = new Map<string, Day>();
  for (const d of out) byDate.set(d.date, d);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function parseProfile(grid: string[][]): Profile {
  const p = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, ''])) as Profile;
  for (const r of grid) {
    const f = PROFILE_FIELDS.find((x) => x.label.toLowerCase() === cell(r, 0).toLowerCase());
    if (!f) continue;
    p[f.key] = f.key === 'dob' ? (cellToIso(cell(r, 1)) ?? cell(r, 1)) : cell(r, 1);
  }
  return p;
}

/** Minutes from one "HH:MM" to the next, wrapping past midnight. */
export function minutesBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  let x = bh * 60 + bm - (ah * 60 + am);
  if (x < 0) x += 1440;
  return x;
}

export const duration = (d: Pick<Day, 'start' | 'end' | 'ongoing'>) => (d.ongoing ? null : minutesBetween(d.start, d.end));
export const sleepMinutes = (d: Pick<Day, 'bed' | 'wake'>) => minutesBetween(d.bed, d.wake);

function toRow(d: DayInput): (string | number)[] {
  if (!d.headache) return [d.date, 'No', ...Array(HEADER.length - 3).fill(''), new Date().toISOString()];
  const dur = duration(d);
  const sl = sleepMinutes(d);
  const join = (a: string[]) => text(a.join(', '));
  return [
    d.date,
    'Yes',
    d.start,
    d.ongoing ? '' : d.end,
    dur ?? '',
    d.ongoing ? 'Yes' : 'No',
    d.pain ?? '',
    join(d.location),
    join(d.feel),
    join(d.symptoms),
    d.medTaken ? 'Yes' : 'No',
    d.medTaken ? text(d.medName) : '',
    // A leading apostrophe keeps "1½" and "½" as text.
    d.medTaken && d.dose ? `'${d.dose}` : '',
    d.medTaken ? d.medTime : '',
    d.medTaken ? d.relief : '',
    d.bed,
    d.wake,
    sl == null ? '' : Math.round((sl / 60) * 10) / 10,
    d.quality,
    text(d.food),
    join(d.foodTags),
    d.water,
    d.caffeine ?? '',
    d.stress ?? '',
    d.screen ?? '',
    join(d.factors),
    text(d.notes),
    new Date().toISOString(),
  ];
}

// ------------------------------------------------------------------ reads ---

export async function loadDiary(): Promise<{ days: Day[]; profile: Profile }> {
  const s = await ready();
  const [daysGrid, profileGrid] = await s.batchGet([DAYS_RANGE, PROFILE_RANGE]);
  return { days: parseDays(daysGrid), profile: parseProfile(profileGrid) };
}

// ----------------------------------------------------------------- writes ---

export async function saveDay(input: DayInput, opts: { replaceAttack?: boolean } = {}) {
  if (input.date > todayIST()) throw new UserError("You can't log a day that hasn't happened yet.");
  if (input.headache && !input.start) throw new UserError('Add the time the headache started.');
  const s = await ready();
  const [grid] = await s.batchGet([DAYS_RANGE]);
  const existing = parseDays(grid).find((d) => d.date === input.date);
  if (existing?.headache && !input.headache && !opts.replaceAttack) {
    throw new UserError('That day already has an attack logged. Open it to edit or delete it.');
  }
  const row = toRow(input);
  if (existing) await s.batchUpdate([{ range: `${DAYS_TAB}!A${existing.row}:${LAST_COL}${existing.row}`, values: [row] }]);
  else await s.append(`${DAYS_TAB}!A:${LAST_COL}`, [row]);
}

export async function deleteDay(date: string) {
  const s = await ready();
  const [grid] = await s.batchGet([DAYS_RANGE]);
  const existing = parseDays(grid).find((d) => d.date === date);
  if (!existing) return;
  await s.batchUpdate([{ range: `${DAYS_TAB}!A${existing.row}:${LAST_COL}${existing.row}`, values: [Array(HEADER.length).fill('')] }]);
}

export async function saveProfile(p: Profile) {
  const s = await ready();
  const values = PROFILE_FIELDS.map((f) => [f.label, text(p[f.key])]);
  await s.batchUpdate([{ range: `${PROFILE_TAB}!A2:B${values.length + 1}`, values }]);
}

// --------------------------------------------------------------- insights ---

export const attacksOf = (days: Day[]) => days.filter((d) => d.headache);

export function monthSummary(days: Day[], today = todayIST()) {
  const key = monthKeyOf(today);
  const month = attacksOf(days).filter((d) => d.date.startsWith(key));
  const medDays = month.filter((d) => d.medTaken).length;
  const pains = month.map((d) => d.pain).filter((p): p is number => p != null);
  const last = attacksOf(days).at(-1);
  return {
    attacks: month.length,
    avgPain: pains.length ? pains.reduce((a, b) => a + b, 0) / pains.length : null,
    medDays,
    sinceLast: last ? daysBetween(last.date, today) : null,
  };
}

/** Dates in the last `n` days (not today) with nothing logged. */
export function missedDays(days: Day[], n = 7, today = todayIST()): string[] {
  const logged = new Set(days.map((d) => d.date));
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = addDays(today, -i);
    if (!logged.has(d)) out.push(d);
  }
  return out;
}

type Count = { label: string; n: number };
const ranked = (m: Map<string, number>, limit = 8): Count[] =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, n]) => ({ label, n }));

export function patterns(days: Day[], rangeDays: number | null, today = todayIST()) {
  const from = rangeDays == null ? '0000-00-00' : addDays(today, -rangeDays);
  const all = attacksOf(days);
  const a = all.filter((d) => d.date > from);
  const n = a.length;
  const firstLogged = days[0]?.date ?? today;
  const span = rangeDays ?? Math.max(30, daysBetween(firstLogged, today) + 1);
  const logged = days.filter((d) => d.date > from).length;

  const pains = a.map((d) => d.pain).filter((p): p is number => p != null);
  const durs = a.map(duration).filter((x): x is number => x != null);

  // What was logged before each attack.
  const before = new Map<string, number>();
  const inc = (k: string) => before.set(k, (before.get(k) ?? 0) + 1);
  for (const d of a) {
    d.foodTags.forEach(inc);
    d.factors.forEach(inc);
    if (d.water === 'Low') inc('Low water');
    if ((d.caffeine ?? 0) >= 3) inc('3+ cups of chai / coffee');
    if ((d.stress ?? 0) >= 4) inc('High stress (4–5)');
    if ((d.screen ?? 0) >= 8) inc('8h+ screen time');
    const sl = sleepMinutes(d);
    if (sl != null && sl < 360) inc('Slept under 6h');
    if (d.quality === 'Poor') inc('Poor sleep');
    if (d.bed) {
      const [h] = d.bed.split(':').map(Number);
      if (h < 5) inc('Bed after midnight');
    }
  }

  const sleeps = a.map(sleepMinutes).filter((x): x is number => x != null);
  const hour = (t: string) => Number(t.split(':')[0]);
  const timeOfDay = [0, 0, 0, 0]; // night, morning, afternoon, evening
  a.forEach((d) => d.start && timeOfDay[Math.floor(hour(d.start) / 6)]++);
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  a.forEach((d) => weekdays[new Date(`${d.date}T00:00:00Z`).getUTCDay()]++);

  const months: { key: string; n: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = dt.toISOString().slice(0, 7);
    months.push({ key, n: all.filter((d) => d.date.startsWith(key)).length });
  }

  const took = a.filter((d) => d.medTaken);
  const relief = new Map<string, number>();
  took.forEach((d) => d.relief && relief.set(d.relief, (relief.get(d.relief) ?? 0) + 1));
  const lags = took.map((d) => minutesBetween(d.start, d.medTime)).filter((x): x is number => x != null && x < 720);

  const symptoms = new Map<string, number>();
  a.forEach((d) => d.symptoms.forEach((s) => symptoms.set(s, (symptoms.get(s) ?? 0) + 1)));
  const where = new Map<string, number>();
  a.forEach((d) => d.location.forEach((s) => where.set(s, (where.get(s) ?? 0) + 1)));

  return {
    n,
    logged,
    perMonth: (n / span) * 30,
    avgPain: pains.length ? pains.reduce((x, y) => x + y, 0) / pains.length : null,
    avgDuration: durs.length ? durs.reduce((x, y) => x + y, 0) / durs.length : null,
    before: ranked(before),
    sleep: {
      avg: sleeps.length ? sleeps.reduce((x, y) => x + y, 0) / sleeps.length / 60 : null,
      under6: sleeps.length ? sleeps.filter((x) => x < 360).length / sleeps.length : null,
      logged: sleeps.length,
    },
    timeOfDay,
    weekdays,
    months,
    medicine: {
      took: took.length,
      relief: RELIEF.filter((r) => relief.has(r)).map((label) => ({ label, n: relief.get(label)! })),
      reliefAnswered: [...relief.values()].reduce((x, y) => x + y, 0),
      avgLag: lags.length ? lags.reduce((x, y) => x + y, 0) / lags.length : null,
    },
    symptoms: ranked(symptoms, 6),
    where: ranked(where, 6),
  };
}

// ------------------------------------------------------------- formatting ---

export function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

export function fmtTime(t: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''} ${h >= 12 ? 'pm' : 'am'}`;
}

/** Colour band for a pain score, used by CSS as data-pain. */
export function painBand(p: number | null): 'none' | 'mild' | 'mod' | 'sev' | 'max' {
  if (p == null || p === 0) return 'none';
  if (p <= 3) return 'mild';
  if (p <= 6) return 'mod';
  if (p <= 8) return 'sev';
  return 'max';
}

export function ageOn(dob: string, today = todayIST()): number | null {
  const iso = cellToIso(dob);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// -------------------------------------------------------------------- CSV ---

export function toCsv(days: Day[], profile: Profile): string {
  const q = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = PROFILE_FIELDS.filter((f) => profile[f.key]).map((f) => `# ${f.label}: ${profile[f.key]}`);
  const rows = days.map((d) => {
    if (!d.headache) return [d.date, 'No'].map(q).join(',');
    const sl = sleepMinutes(d);
    return [
      d.date,
      'Yes',
      d.start,
      d.end,
      duration(d) ?? '',
      d.ongoing ? 'Yes' : 'No',
      d.pain ?? '',
      d.location.join('; '),
      d.feel.join('; '),
      d.symptoms.join('; '),
      d.medTaken ? 'Yes' : 'No',
      d.medName,
      d.dose,
      d.medTime,
      d.relief,
      d.bed,
      d.wake,
      sl == null ? '' : (sl / 60).toFixed(1),
      d.quality,
      d.food,
      d.foodTags.join('; '),
      d.water,
      d.caffeine ?? '',
      d.stress ?? '',
      d.screen ?? '',
      d.factors.join('; '),
      d.notes,
    ]
      .map(q)
      .join(',');
  });
  return [...head, HEADER.slice(0, -1).map(q).join(','), ...rows].join('\n') + '\n';
}
