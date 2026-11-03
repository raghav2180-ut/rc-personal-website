/**
 * Saturday review, built around Vision 2029. Five steps, each saved on its own:
 *   1 Look back      — scorecard from the week's data; win and recurring worry
 *   2 Close goals    — result, why, and what next for every weekly goal
 *   3 Vision check   — six life areas scored 1–10, "what moved me closer"
 *   4 Numbers        — money collected and new conversions, each with a note
 *   5 Plan next week — ONE thing, 3 big goals + up to 2 more, say no, close
 *
 * Writes to Weekly (G–K), Scores (one row per week), Reviews (one row per week),
 * and, for Raghav, Goals!I (FY totals) when they changed.
 */
import { UserError, text } from './actions';
import { FY_GOALS, parseCheckIns, parseGoals, parseScores, parseTop3, parseWeekly, RANGES, SCORE_AREAS, WEEKLY_CAP, type WeeklyGoal } from './data';
import { addDays, cellToIso, dayMonth, weekStart } from './dates';
import type { Person } from './env';
import { sheets, type Grid } from './sheets';

export const BIG_ROCKS = 3;

/** The six life areas, each with its 2029 picture from the vision. */
export const AREAS = [
  { name: 'UnsaidTalks', vision: '40+ team, 10 tech clients, 300 F.U.E.L students, ₹6 Cr+ a year' },
  { name: 'Personal money', vision: '₹6–8L a month for you and Kajol, your own 4BHK' },
  { name: 'Family', vision: 'Parents and Harshit at home, time together, the Dubai trip' },
  { name: 'Health & energy', vision: 'Rested, a morning walk, a healthy breakfast' },
  { name: 'Personal brand', vision: '50,000 on LinkedIn, 1 lakh on Instagram' },
  { name: 'Calm & confidence', vision: 'Calm, confident and focused in mind and body' },
] as const;

/** Goal areas for next week: FY goals plus the non-work life areas. */
export const LIFE_AREAS = ['Personal money', 'Family', 'Health & energy', 'Personal brand', 'Calm & confidence'];
export const GOAL_AREAS = [...FY_GOALS.filter((g) => g !== 'Personal'), ...LIFE_AREAS, 'Personal'];
const NON_WORK = new Set([...LIFE_AREAS, 'Personal']);

export const NUMBERS = [
  { key: 'money', label: 'Money collected this week', unit: '₹' },
  { key: 'fuel', label: 'New F.U.E.L conversions', unit: '' },
  { key: 'ump', label: 'New UMP Ultimate conversions', unit: '' },
  { key: 'tech', label: 'New tech client conversions', unit: '' },
  { key: 'college', label: 'New college conversions', unit: '' },
] as const;

export const WHY = ['Underestimated it', 'Pushed aside', 'Waiting on someone', 'Chose not to'];
export const RESULTS = [
  { value: 'Done', label: 'Done' },
  { value: 'Partially done', label: 'Partly' },
  { value: 'Not done', label: 'Not done' },
];

export const REVIEW_HEADER = [
  'Week', 'Person', 'Steps done', 'Win of the week', 'Worry that keeps coming back',
  ...AREAS.map((a) => `Closer: ${a.name}`),
  ...NUMBERS.flatMap((n) => [n.label, `${n.label}: note`]),
  'ONE thing', 'Say no to', 'Lesson', 'What 2029 me would do differently', 'Energy', 'Summary', 'Updated',
];
const COL = Object.fromEntries(REVIEW_HEADER.map((h, i) => [h, i]));
const REVIEW_RANGE = 'Reviews!A2:AB';
const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));

export interface ReviewRow {
  row: number;
  week: string;
  person: string;
  steps: Set<number>;
  cells: string[];
}

function parseReviews(grid: Grid): ReviewRow[] {
  return grid
    .map((r, i): ReviewRow | null => {
      const week = cellToIso(r[0]);
      if (!week) return null;
      const cells = REVIEW_HEADER.map((_, j) => (r[j] ?? '').toString());
      // Stored as "S1 S2 S3" so Sheets never reads it as a number.
      const steps = new Set((cells[2].match(/[1-5]/g) ?? []).map(Number));
      return { row: i + 2, week: weekStart(week), person: cells[1], steps, cells };
    })
    .filter((x): x is ReviewRow => !!x);
}

export const reviewValue = (r: ReviewRow | null, header: string) => (r ? r.cells[COL[header]] ?? '' : '');

// ------------------------------------------------------------------ load ---

export async function loadReview(person: Person, week: string) {
  const s = sheets();
  await s.ensureTab('Reviews', REVIEW_HEADER);
  const [top3Grid, ciGrid, weeklyGrid, scoresGrid, goalsGrid, reviewGrid] = await s.batchGet([
    RANGES.top3, RANGES.checkins, RANGES.weekly, RANGES.scores, RANGES.goals, REVIEW_RANGE,
  ]);
  const top3 = parseTop3(top3Grid).filter((t) => t.person === person && !t.bonus);
  const checkins = parseCheckIns(ciGrid).filter((c) => c.person === person);
  const weekly = parseWeekly(weeklyGrid).filter((g) => g.person === person);
  const scores = parseScores(scoresGrid).filter((x) => x.person === person);
  const review = parseReviews(reviewGrid).find((r) => r.week === week && r.person === person) ?? null;

  const days = [0, 1, 2, 3, 4, 5].map((i) => addDays(week, i));
  const statsFor = (w: string) => {
    const ds = [0, 1, 2, 3, 4, 5].map((i) => addDays(w, i));
    const items = top3.filter((t) => ds.includes(t.date));
    const cis = checkins.filter((c) => ds.includes(c.date));
    const goals = weekly.filter((g) => g.week === w);
    return {
      week: w,
      goals: goals.length,
      goalsDone: goals.filter((g) => g.status === 'Done').length,
      top3: items.length,
      top3Done: items.filter((t) => t.done === 'Yes').length,
      top3Part: items.filter((t) => t.done === 'Partial').length,
      deep: cis.filter((c) => c.deep === 'Yes').length,
      walk: cis.filter((c) => c.walk === 'Yes').length,
      vision: cis.filter((c) => c.vision === 'Yes').length,
    };
  };
  const now = statsFor(week);
  const trend = [-3, -2, -1, 0].map((k) => statsFor(addDays(week, k * 7)));

  const weekCis = checkins.filter((c) => days.includes(c.date));
  const displaced = new Map<string, number>();
  for (const c of weekCis) if (c.displaced && c.displaced !== 'Nothing') displaced.set(c.displaced, (displaced.get(c.displaced) ?? 0) + 1);

  // Scores: this week's row is keyed on the week's Saturday.
  const sat = addDays(week, 5);
  const thisScore = scores.find((x) => x.date === sat) ?? null;
  const lastScore = [...scores].filter((x) => x.date < sat).sort((a, b) => a.date.localeCompare(b.date)).pop() ?? null;

  const nextWeek = addDays(week, 7);
  return {
    week,
    sat,
    nextWeek,
    now,
    trend,
    displaced: [...displaced.entries()].sort((a, b) => b[1] - a[1]),
    wins: weekCis.filter((c) => c.win).map((c) => ({ date: c.date, text: c.win })),
    worries: weekCis.filter((c) => c.worry).map((c) => ({ date: c.date, text: c.worry })),
    goals: weekly.filter((g) => g.week === week),
    nextGoals: weekly.filter((g) => g.week === nextWeek),
    thisScore,
    lastScore,
    review,
    progress: person === 'Raghav' ? parseGoals(goalsGrid).progress : [],
  };
}

// ----------------------------------------------------------------- saving ---

async function upsertReview(person: Person, week: string, step: number, values: Record<string, string>) {
  const s = sheets();
  await s.ensureTab('Reviews', REVIEW_HEADER);
  const [grid] = await s.batchGet([REVIEW_RANGE]);
  const existing = parseReviews(grid).find((r) => r.week === week && r.person === person);
  const cells = existing ? [...existing.cells] : REVIEW_HEADER.map(() => '');
  const steps = new Set(existing?.steps ?? []);
  steps.add(step);
  cells[0] = week;
  cells[1] = person;
  cells[2] = [...steps].sort().map((n) => `S${n}`).join(' ');
  for (const [k, v] of Object.entries(values)) cells[COL[k]] = text(v);
  cells[COL['Updated']] = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const last = colLetter(REVIEW_HEADER.length - 1);
  if (existing) await s.batchUpdate([{ range: `Reviews!A${existing.row}:${last}${existing.row}`, values: [cells] }]);
  else await s.append(`Reviews!A:${last}`, [cells]);
}

/** Step 1: win of the week and the worry that keeps coming back. */
export async function saveLookBack(person: Person, week: string, win: string, worry: string) {
  await upsertReview(person, week, 1, { 'Win of the week': win.slice(0, 1000), 'Worry that keeps coming back': worry.slice(0, 1000) });
}

/** Step 2: close every goal. Carried-over goals are added to next week. */
export async function saveCloseGoals(
  person: Person,
  week: string,
  decisions: { row: number; result: string; why: string; next: string; handTo: string }[],
) {
  const s = sheets();
  const [weeklyGrid] = await s.batchGet([RANGES.weekly]);
  const all = parseWeekly(weeklyGrid).filter((g) => g.person === person);
  const goals = new Map(all.filter((g) => g.week === week).map((g) => [g.row, g]));
  const nextWeek = addDays(week, 7);
  const nextGoals = all.filter((g) => g.week === nextWeek);
  const updates: { range: string; values: (string | number)[][] }[] = [];
  const carry: WeeklyGoal[] = [];
  for (const d of decisions) {
    const g = goals.get(d.row);
    if (!g) throw new UserError('A goal moved in the sheet. Refresh and try again.');
    if (!RESULTS.some((r) => r.value === d.result)) throw new UserError(`Pick Done, Partly or Not done for “${g.goal.slice(0, 60)}”.`);
    const done = d.result === 'Done';
    const why = done ? '' : WHY.includes(d.why) ? d.why : '';
    let next = '';
    if (!done) {
      if (d.next === 'Carry over') next = 'Carry over';
      else if (d.next === 'Drop') next = 'Drop';
      else if (d.next === 'Hand to') {
        if (!d.handTo.trim()) throw new UserError(`Who are you handing “${g.goal.slice(0, 60)}” to?`);
        next = `Hand to: ${d.handTo.trim().slice(0, 60)}`;
      }
    }
    updates.push({ range: `Weekly!E${g.row}`, values: [[d.result]] });
    updates.push({ range: `Weekly!G${g.row}:H${g.row}`, values: [[why, text(next)]] });
    if (next === 'Carry over' && !nextGoals.some((n) => n.goal.toLowerCase() === g.goal.toLowerCase())) carry.push(g);
  }
  if (nextGoals.length + carry.length > WEEKLY_CAP) {
    throw new UserError(`Carrying ${carry.length} over would make ${nextGoals.length + carry.length} goals next week. The cap is ${WEEKLY_CAP}: drop or hand some off.`);
  }
  await s.batchUpdate(updates);
  if (carry.length) {
    await s.append(
      'Weekly!A:K',
      carry.map((g) => [nextWeek, person, g.fy, text(g.goal), 'Not started', `Carried over from week of ${dayMonth(week)}`, '', '', '', text(g.firstStep), '']),
    );
  }
  await upsertReview(person, week, 2, {});
}

/** Step 3: score the six life areas and note what moved each one closer. */
export async function saveVisionCheck(person: Person, week: string, scores: (number | null)[], closer: string[]) {
  const s = sheets();
  const [scoresGrid] = await s.batchGet([RANGES.scores]);
  const sat = addDays(week, 5);
  const cells = scores.map((v) => (v === null ? '' : Math.min(10, Math.max(1, Math.round(v)))));
  const existing = parseScores(scoresGrid).find((x) => x.date === sat && x.person === person);
  if (existing) await s.batchUpdate([{ range: `Scores!C${existing.row}:H${existing.row}`, values: [cells] }]);
  else await s.append('Scores!A:H', [[sat, person, ...cells]]);
  await upsertReview(person, week, 3, Object.fromEntries(AREAS.map((a, i) => [`Closer: ${a.name}`, (closer[i] ?? '').slice(0, 500)])));
}

/** Step 4: the week's money and conversions, each with a note. FY totals only when they changed. */
export async function saveNumbers(
  person: Person,
  week: string,
  numbers: Record<string, { value: string; note: string }>,
  fyTotals: Map<number, number>,
) {
  const values: Record<string, string> = {};
  for (const n of NUMBERS) {
    const raw = (numbers[n.key]?.value ?? '').replace(/[,₹\s]/g, '');
    if (raw !== '' && !Number.isFinite(Number(raw))) throw new UserError(`“${n.label}” should be a number.`);
    values[n.label] = raw;
    values[`${n.label}: note`] = (numbers[n.key]?.note ?? '').slice(0, 500);
  }
  if (person === 'Raghav' && fyTotals.size) {
    const s = sheets();
    const [goalsGrid] = await s.batchGet([RANGES.goals]);
    const progress = parseGoals(goalsGrid).progress;
    const updates = [];
    for (const p of progress) {
      const v = fyTotals.get(p.row);
      if (v !== undefined && Number.isFinite(v) && v !== p.current) updates.push({ range: `Goals!I${p.row}`, values: [[v]] });
    }
    if (updates.length) await s.batchUpdate(updates);
  }
  await upsertReview(person, week, 4, values);
}

export interface PlanGoal {
  row?: number; // an existing next-week goal
  remove?: boolean;
  area: string;
  goal: string;
  day: string;
  firstStep: string;
}

/** Step 5: plan next week and close the review. */
export async function savePlan(
  person: Person,
  week: string,
  input: { one: string; sayNo: string; lesson: string; future: string; energy: number | null; workOnly: boolean; goals: PlanGoal[] },
) {
  if (!input.one.trim()) throw new UserError('Write the ONE thing for next week.');
  const s = sheets();
  const [weeklyGrid, top3Grid, ciGrid] = await s.batchGet([RANGES.weekly, RANGES.top3, RANGES.checkins]);
  const all = parseWeekly(weeklyGrid).filter((g) => g.person === person);
  const nextWeek = addDays(week, 7);
  const nextDays = [0, 1, 2, 3, 4, 5].map((i) => addDays(nextWeek, i));
  const existing = new Map(all.filter((g) => g.week === nextWeek).map((g) => [g.row, g]));

  // Goals already in next week but not in the form (added elsewhere meanwhile) still count.
  const mentioned = new Set(input.goals.map((g) => g.row).filter(Boolean));
  const untouched: PlanGoal[] = [...existing.values()]
    .filter((g) => !mentioned.has(g.row))
    .map((g) => ({ row: g.row, area: g.fy, goal: g.goal, day: g.day, firstStep: g.firstStep }));
  const kept = [...input.goals.filter((g) => g.row && !g.remove && existing.has(g.row)), ...untouched];
  const removed = input.goals.filter((g) => g.row && g.remove && existing.has(g.row));
  const fresh = input.goals.filter((g) => !g.row && g.goal.trim());
  for (const g of [...kept.filter((g) => !untouched.includes(g)), ...fresh]) {
    if (!g.goal.trim()) throw new UserError('A goal is empty. Write it or tick Remove.');
    if (!GOAL_AREAS.includes(g.area)) throw new UserError(`Pick an area for “${g.goal.slice(0, 60)}”.`);
    if (g.day && !nextDays.includes(g.day)) throw new UserError('Pick a day in next week.');
  }
  const plan = [...kept, ...fresh];
  if (plan.length === 0) throw new UserError('Add at least one goal for next week.');
  if (plan.length > WEEKLY_CAP) throw new UserError(`That's ${plan.length} goals. The cap is ${BIG_ROCKS} big goals plus up to ${WEEKLY_CAP - BIG_ROCKS} more.`);
  if (!input.workOnly && !plan.some((g) => NON_WORK.has(g.area))) {
    throw new UserError('Add one goal for health, family, money or brand, or tick “Work-only week”.');
  }

  const updates: { range: string; values: (string | number)[][] }[] = [];
  plan.forEach((g, i) => {
    const priority = i < BIG_ROCKS ? 'Big' : 'Extra';
    if (g.row) {
      updates.push({ range: `Weekly!C${g.row}:D${g.row}`, values: [[g.area, text(g.goal)]] });
      updates.push({ range: `Weekly!I${g.row}:K${g.row}`, values: [[g.day, text(g.firstStep), priority]] });
    }
  });
  for (const g of removed) {
    updates.push({ range: `Weekly!A${g.row}:K${g.row}`, values: [Array(11).fill('')] });
  }
  if (updates.length) await s.batchUpdate(updates);
  const appendRows = fresh.map((g) => {
    const i = plan.indexOf(g);
    return [nextWeek, person, g.area, text(g.goal), 'Not started', '', '', '', g.day, text(g.firstStep), i < BIG_ROCKS ? 'Big' : 'Extra'];
  });
  if (appendRows.length) await s.append('Weekly!A:K', appendRows);

  // A one-line summary of the week, for the Monthly log.
  const days = [0, 1, 2, 3, 4, 5].map((i) => addDays(week, i));
  const goals = all.filter((g) => g.week === week);
  const items = parseTop3(top3Grid).filter((t) => t.person === person && !t.bonus && days.includes(t.date));
  const deep = parseCheckIns(ciGrid).filter((c) => c.person === person && days.includes(c.date) && c.deep === 'Yes').length;
  const summary = [
    `${goals.filter((g) => g.status === 'Done').length}/${goals.length} goals done`,
    items.length ? `Top 3 ${Math.round((items.filter((t) => t.done === 'Yes').length / items.length) * 100)}%` : '',
    `deep work ${deep}/6`,
    `next: ${input.one.trim().slice(0, 120)}`,
  ].filter(Boolean).join(' · ');

  await upsertReview(person, week, 5, {
    'ONE thing': input.one.slice(0, 500),
    'Say no to': input.sayNo.slice(0, 500),
    Lesson: input.lesson.slice(0, 1000),
    'What 2029 me would do differently': input.future.slice(0, 1000),
    Energy: input.energy === null ? '' : String(Math.min(10, Math.max(1, Math.round(input.energy)))),
    Summary: summary,
  });
}

export { SCORE_AREAS };
