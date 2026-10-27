/**
 * Every write the Life Tracker makes to the sheet. Each one re-reads the rows
 * it touches first, so a row that moved (someone sorted the tab, say) is never
 * overwritten by mistake.
 */
import {
  DISPLACED,
  FY_GOALS,
  parseCheckIns,
  parseGoals,
  parseMonthly,
  parseScores,
  parseTop3,
  parseWeekly,
  RANGES,
  SCORE_AREAS,
  STATUSES,
  WEEKLY_CAP,
} from './data';
import { addDays, cellToIso, monthLabel, todayIST, weekStart } from './dates';
import type { Person } from './env';
import { sheets } from './sheets';

export class UserError extends Error {}

/** Stop text that starts with = + - @ from being read as a formula. */
export function text(value: string): string {
  const v = value.trim();
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

const ynOrBlank = (v: string | null) => (v === 'Yes' || v === 'No' ? v : '');

// ------------------------------------------------------------------ Top 3 ---

export async function setTop3Done(input: { row: number; date: string; person: Person; done: 'Yes' | 'No' }) {
  const s = sheets();
  const [top3Grid, ciGrid] = await s.batchGet([RANGES.top3, RANGES.checkins]);
  const items = parseTop3(top3Grid);
  const item = items.find((t) => t.row === input.row);
  if (!item || item.date !== input.date || item.person !== input.person) {
    throw new UserError('That task moved in the sheet. Refresh and try again.');
  }
  item.done = input.done;

  const updates: { range: string; values: (string | number)[][] }[] = [{ range: `Top3!E${item.row}`, values: [[input.done]] }];

  // Keep "Top 3 done (of 3)" on the day's check-in in step.
  const doneCount = items.filter((t) => t.date === input.date && t.person === input.person && !t.bonus && t.done === 'Yes').length;
  const ci = parseCheckIns(ciGrid).find((c) => c.date === input.date && c.person === input.person);
  if (ci) updates.push({ range: `CheckIns!D${ci.row}`, values: [[doneCount]] });

  await s.batchUpdate(updates);
}

export async function addTop3(input: { date: string; person: Person; task: string; fy: string }) {
  const task = input.task.trim();
  if (!task) throw new UserError('Write the task first.');
  const s = sheets();
  const [top3Grid] = await s.batchGet([RANGES.top3]);
  const today = parseTop3(top3Grid).filter((t) => t.date === input.date && t.person === input.person);
  const n = today.reduce((m, t) => Math.max(m, t.n), 0) + 1;
  const label = n > 3 && !/\(bonus\)/i.test(task) ? `${task} (bonus)` : task;
  const fy = FY_GOALS.includes(input.fy) ? input.fy : '';
  await s.append('Top3!A:F', [[input.date, input.person, n, text(label), '', fy]]);
}

// --------------------------------------------------------------- Check-in ---

export interface CheckInInput {
  date: string;
  person: Person;
  vision: string | null;
  walk: string | null;
  deep: string | null;
  night: string | null;
  displaced: string | null;
  win: string;
  worry: string;
}

export async function saveCheckIn(input: CheckInInput) {
  const s = sheets();
  const [top3Grid, ciGrid] = await s.batchGet([RANGES.top3, RANGES.checkins]);
  const doneCount = parseTop3(top3Grid).filter(
    (t) => t.date === input.date && t.person === input.person && !t.bonus && t.done === 'Yes',
  ).length;
  const displaced = input.displaced && DISPLACED.includes(input.displaced) ? input.displaced : '';
  const existing = parseCheckIns(ciGrid).find((c) => c.date === input.date && c.person === input.person);

  const front = [ynOrBlank(input.vision), doneCount, ynOrBlank(input.walk), ynOrBlank(input.night), text(input.win), text(input.worry)];
  const back = [ynOrBlank(input.deep), displaced];

  if (existing) {
    await s.batchUpdate([
      { range: `CheckIns!C${existing.row}:H${existing.row}`, values: [front] },
      { range: `CheckIns!J${existing.row}:K${existing.row}`, values: [back] },
    ]);
  } else {
    await s.append('CheckIns!A:K', [[input.date, input.person, ...front, '', ...back]]);
  }
}

// ----------------------------------------------------------------- Weekly ---

export async function setWeeklyStatus(input: { row: number; week: string; person: Person; status: string }) {
  if (!(STATUSES as readonly string[]).includes(input.status)) throw new UserError('Unknown status.');
  const s = sheets();
  const [weeklyGrid] = await s.batchGet([RANGES.weekly]);
  const goal = parseWeekly(weeklyGrid).find((g) => g.row === input.row);
  if (!goal || goal.week !== input.week || goal.person !== input.person) {
    throw new UserError('That goal moved in the sheet. Refresh and try again.');
  }
  await s.batchUpdate([{ range: `Weekly!E${goal.row}`, values: [[input.status]] }]);
}

export async function addWeeklyGoals(person: Person, week: string, goals: { fy: string; goal: string }[]) {
  const s = sheets();
  const [weeklyGrid] = await s.batchGet([RANGES.weekly]);
  const existing = parseWeekly(weeklyGrid).filter((g) => g.week === week && g.person === person);
  const seen = new Set(existing.map((g) => g.goal.toLowerCase()));
  const fresh = goals
    .map((g) => ({ fy: FY_GOALS.includes(g.fy) ? g.fy : '', goal: g.goal.trim() }))
    .filter((g) => g.goal && !seen.has(g.goal.toLowerCase()));
  if (existing.length + fresh.length > WEEKLY_CAP) {
    throw new UserError(`That would make ${existing.length + fresh.length} goals. The cap is ${WEEKLY_CAP} a week.`);
  }
  await s.append(
    'Weekly!A:F',
    fresh.map((g) => [week, person, g.fy, text(g.goal), 'Not started', '']),
  );
  return fresh.length;
}

// --------------------------------------------------------- Saturday review ---

export async function saveReview(input: {
  person: Person;
  week: string;
  numbers: Map<number, number>; // Goals row -> current value
  scores: (number | null)[];
  slipped: string;
  next: { fy: string; goal: string }[];
}) {
  const s = sheets();
  const [goalsGrid, scoresGrid] = await s.batchGet([RANGES.goals, RANGES.scores]);
  const progressRows = new Set(parseGoals(goalsGrid).progress.map((p) => p.row));

  const updates: { range: string; values: (string | number)[][] }[] = [];
  for (const [row, value] of input.numbers) {
    if (progressRows.has(row) && Number.isFinite(value)) updates.push({ range: `Goals!I${row}`, values: [[value]] });
  }

  // Scores: one row per person per review day. A second submit updates it.
  const date = todayIST();
  const scoreCells = input.scores.map((v) => (v === null ? '' : Math.min(10, Math.max(1, Math.round(v)))));
  const hasScores = scoreCells.some((v) => v !== '') || input.slipped.trim();
  if (hasScores) {
    if (!(scoresGrid[0]?.[8] ?? '')) updates.push({ range: 'Scores!I1', values: [['What slipped']] });
    const existing = parseScores(scoresGrid).find((r) => r.date === date && r.person === input.person);
    if (existing) {
      updates.push({ range: `Scores!C${existing.row}:I${existing.row}`, values: [[...scoreCells, text(input.slipped)]] });
    }
    await s.batchUpdate(updates);
    if (!existing) await s.append('Scores!A:I', [[date, input.person, ...scoreCells, text(input.slipped)]]);
  } else {
    await s.batchUpdate(updates);
  }

  const goals = input.next.filter((g) => g.goal.trim());
  if (goals.length) await addWeeklyGoals(input.person, addDays(input.week, 7), goals);
}

// ---------------------------------------------------------------- Monthly ---

export async function saveMonth(input: {
  key: string;
  movements: string;
  notes: string;
  revenue: string;
  fuel: string;
  ump: string;
  colleges: string;
  tech: string;
}) {
  if (!/^\d{4}-\d{2}$/.test(input.key)) throw new UserError('Pick a month.');
  if (!input.movements.trim()) throw new UserError('Write at least one key movement.');
  const s = sheets();
  const [monthlyGrid] = await s.batchGet([RANGES.monthly]);
  const existing = parseMonthly(monthlyGrid).find((m) => m.key === input.key);
  const values = [text(input.movements), input.revenue, input.fuel, input.ump, input.colleges, input.tech, text(input.notes)];
  if (existing) {
    await s.batchUpdate([{ range: `Monthly!B${existing.row}:H${existing.row}`, values: [values] }]);
  } else {
    await s.append('Monthly!A:H', [[monthLabel(input.key, false), ...values]]);
  }
}

// ----------------------------------------------------------------- Vision ---

export async function setVisionNow(row: number, value: string) {
  const s = sheets();
  const [grid] = await s.batchGet([`Vision!C${row}:D${row}`]);
  if (row < 2 || !(grid[0]?.[0] ?? '')) throw new UserError('That measure moved in the sheet. Refresh and try again.');
  await s.batchUpdate([{ range: `Vision!D${row}`, values: [[text(value)]] }]);
}

export { cellToIso, weekStart, SCORE_AREAS };
