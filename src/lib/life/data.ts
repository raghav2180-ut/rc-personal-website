/**
 * Reads the Dream Life 2029 – Tracker sheet and shapes it for each screen.
 * Row numbers are kept on every record so writes can target the exact row.
 */
import { addDays, cellToIso, cellToMonthKey, daysBetween, monthKeyOf, todayIST, weekday, weekStart } from './dates';
import type { Person } from './env';
import { sheets, type Grid } from './sheets';

export const FY_GOALS = ['Colleges', 'Tech clients', 'SOT F.U.E.L', 'UMP Ultimate', 'UMP B2B', 'Revenue', 'Team & ops', 'Personal'];
export const STATUSES = ['Not started', 'In progress', 'Done', 'Partially done', 'Not done'] as const;
export const DISPLACED = ['Nothing', 'Meetings', 'Team', 'Ops & admin', 'Travel', 'Other'];
export const SCORE_AREAS = ['UnsaidTalks', 'Personal money', 'Family', 'Health & energy', 'Personal brand', 'Calm & confidence'];
export const FY_END = '2027-03-31';
export const WEEKLY_CAP = 5;

const R = {
  top3: 'Top3!A2:F',
  checkins: 'CheckIns!A2:K',
  weekly: 'Weekly!A2:F',
  scores: 'Scores!A1:I',
  goals: 'Goals!A1:K40',
  monthly: 'Monthly!A2:H',
  vision: 'Vision!A1:E15',
};

const cell = (row: string[] | undefined, i: number) => (row?.[i] ?? '').toString().trim();
const yn = (v: string): 'Yes' | 'No' | '' => (/^y/i.test(v) ? 'Yes' : /^n/i.test(v) ? 'No' : '');

// ----------------------------------------------------------------- types ---

export interface Top3Item {
  row: number;
  date: string;
  person: string;
  n: number;
  task: string;
  done: 'Yes' | 'No' | 'Partial' | '';
  fy: string;
  bonus: boolean;
}

export interface CheckIn {
  row: number;
  date: string;
  person: string;
  vision: 'Yes' | 'No' | '';
  top3Done: string;
  walk: 'Yes' | 'No' | '';
  night: 'Yes' | 'No' | '';
  win: string;
  worry: string;
  notes: string;
  deep: 'Yes' | 'No' | '';
  displaced: string;
}

export interface WeeklyGoal {
  row: number;
  week: string;
  person: string;
  fy: string;
  goal: string;
  status: string;
  remarks: string;
}

export interface ScoreEntry {
  row: number;
  date: string;
  person: string;
  values: (number | null)[];
  slipped: string;
}

export interface Progress {
  row: number;
  label: string;
  current: number;
  target: number;
  pct: number;
}

export interface GoalRow {
  row: number;
  owner: string;
  area: string;
  goal: string;
  milestones: string;
  revenue: string;
  notes: string;
}

export interface MonthEntry {
  row: number;
  key: string; // "2026-10"
  movements: string;
  revenue: string;
  fuel: string;
  ump: string;
  colleges: string;
  tech: string;
  notes: string;
}

// --------------------------------------------------------------- parsers ---

function parseTop3(grid: Grid): Top3Item[] {
  return grid
    .map((r, i) => {
      const date = cellToIso(cell(r, 0));
      const task = cell(r, 3);
      if (!date || !task) return null;
      const doneRaw = cell(r, 4);
      const done: Top3Item['done'] = /^y/i.test(doneRaw) ? 'Yes' : /^p/i.test(doneRaw) ? 'Partial' : /^n/i.test(doneRaw) ? 'No' : '';
      const n = Number(cell(r, 2)) || 0;
      return { row: i + 2, date, person: cell(r, 1), n, task, done, fy: cell(r, 5), bonus: n > 3 };
    })
    .filter((x): x is Top3Item => !!x);
}

function parseCheckIns(grid: Grid): CheckIn[] {
  return grid
    .map((r, i) => {
      const date = cellToIso(cell(r, 0));
      if (!date) return null;
      return {
        row: i + 2,
        date,
        person: cell(r, 1),
        vision: yn(cell(r, 2)),
        top3Done: cell(r, 3),
        walk: yn(cell(r, 4)),
        night: yn(cell(r, 5)),
        win: cell(r, 6),
        worry: cell(r, 7),
        notes: cell(r, 8),
        deep: yn(cell(r, 9)),
        displaced: cell(r, 10),
      };
    })
    .filter((x): x is CheckIn => !!x);
}

function parseWeekly(grid: Grid): WeeklyGoal[] {
  return grid
    .map((r, i) => {
      const date = cellToIso(cell(r, 0));
      if (!date || !cell(r, 3)) return null;
      return {
        row: i + 2,
        week: weekStart(date),
        person: cell(r, 1),
        fy: cell(r, 2),
        goal: cell(r, 3),
        status: cell(r, 4) || 'Not started',
        remarks: cell(r, 5),
      };
    })
    .filter((x): x is WeeklyGoal => !!x);
}

function parseScores(grid: Grid): ScoreEntry[] {
  return grid
    .slice(1)
    .map((r, i) => {
      const date = cellToIso(cell(r, 0));
      if (!date) return null;
      const values = SCORE_AREAS.map((_, j) => {
        const v = Number(cell(r, 2 + j));
        return cell(r, 2 + j) !== '' && Number.isFinite(v) ? v : null;
      });
      return { row: i + 2, date, person: cell(r, 1), values, slipped: cell(r, 8) };
    })
    .filter((x): x is ScoreEntry => !!x);
}

function num(v: string): number {
  const n = Number(v.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseGoals(grid: Grid) {
  const progress: Progress[] = [];
  const goals: GoalRow[] = [];
  const revenue: { name: string; detail: string; note: string; summary: boolean }[] = [];
  const collegePlan: { phase: string; target: string; check: string }[] = [];
  let collegePlanTitle = '';
  let collegeCheck = '';

  // Progress block H1:K6 (row 1 is the header).
  for (let i = 1; i < grid.length; i++) {
    const label = cell(grid[i], 7);
    if (!label) continue;
    const current = num(cell(grid[i], 8));
    const target = num(cell(grid[i], 9));
    progress.push({ row: i + 1, label, current, target, pct: target ? Math.round((current / target) * 100) : 0 });
  }

  let section: 'goals' | 'revenue' | 'plan' = 'goals';
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const a = cell(r, 0);
    const b = cell(r, 1);
    if (/^revenue baseline/i.test(a)) {
      section = 'revenue';
      continue;
    }
    if (/^college goal plan/i.test(a)) {
      section = 'plan';
      collegePlanTitle = a;
      continue;
    }
    if (section === 'goals') {
      if (!a || !cell(r, 2)) continue;
      goals.push({ row: i + 1, owner: a, area: b, goal: cell(r, 2), milestones: cell(r, 3), revenue: cell(r, 4), notes: cell(r, 5) });
    } else if (section === 'revenue') {
      if (!a) continue;
      revenue.push({ name: a, detail: b, note: cell(r, 5), summary: /^summary/i.test(a) });
    } else if (section === 'plan') {
      if (!b) continue;
      if (cell(r, 3)) collegeCheck = cell(r, 3);
      collegePlan.push({ phase: b, target: cell(r, 2), check: cell(r, 3) });
    }
  }
  return { progress, goals, revenue, collegePlan, collegePlanTitle, collegeCheck };
}

function parseMonthly(grid: Grid): MonthEntry[] {
  return grid
    .map((r, i) => {
      const key = cellToMonthKey(cell(r, 0));
      if (!key) return null;
      return {
        row: i + 2,
        key,
        movements: cell(r, 1),
        revenue: cell(r, 2),
        fuel: cell(r, 3),
        ump: cell(r, 4),
        colleges: cell(r, 5),
        tech: cell(r, 6),
        notes: cell(r, 7),
      };
    })
    .filter((x): x is MonthEntry => !!x)
    .sort((x, y) => y.key.localeCompare(x.key));
}

// ---------------------------------------------------------- shared views ---

export interface DayStatus {
  date: string;
  top3Done: number;
  top3Total: number;
  vision: string;
  walk: string;
  deep: string;
  hasCheckIn: boolean;
}

function dayStatus(date: string, person: string, top3: Top3Item[], checkins: CheckIn[]): DayStatus {
  const items = top3.filter((t) => t.date === date && t.person === person && !t.bonus);
  const ci = checkins.find((c) => c.date === date && c.person === person);
  return {
    date,
    top3Done: items.filter((t) => t.done === 'Yes').length,
    top3Total: items.length,
    vision: ci?.vision ?? '',
    walk: ci?.walk ?? '',
    deep: ci?.deep ?? '',
    hasCheckIn: !!ci,
  };
}

function weekDays(week: string): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(week, i));
}

function weekSummary(person: string, week: string, top3: Top3Item[], checkins: CheckIn[], weekly: WeeklyGoal[]) {
  const days = weekDays(week).map((d) => dayStatus(d, person, top3, checkins));
  const goals = weekly.filter((g) => g.week === week && g.person === person);
  return {
    days,
    goals,
    goalsDone: goals.filter((g) => g.status === 'Done').length,
    top3Done: days.reduce((s, d) => s + d.top3Done, 0),
    top3Total: days.reduce((s, d) => s + d.top3Total, 0),
    deepDays: days.filter((d) => d.deep === 'Yes').length,
    walkDays: days.filter((d) => d.walk === 'Yes').length,
  };
}

// ---------------------------------------------------------------- screens ---

export async function loadToday(person: Person, date = todayIST()) {
  const [top3Grid, ciGrid, weeklyGrid] = await sheets().batchGet([R.top3, R.checkins, R.weekly]);
  const top3 = parseTop3(top3Grid);
  const checkins = parseCheckIns(ciGrid);
  const weekly = parseWeekly(weeklyGrid);
  const items = top3.filter((t) => t.date === date && t.person === person).sort((a, b) => a.n - b.n);
  const checkin = checkins.find((c) => c.date === date && c.person === person) ?? null;
  const week = weekStart(date);
  const summary = weekSummary(person, week, top3, checkins, weekly);
  const main = items.filter((t) => !t.bonus);
  return {
    date,
    week,
    items,
    checkin,
    summary,
    doneCount: main.filter((t) => t.done === 'Yes').length,
    mainCount: main.length,
    focus: main.find((t) => t.done !== 'Yes') ?? null,
    nextNumber: items.reduce((m, t) => Math.max(m, t.n), 0) + 1,
  };
}

export async function loadWeek(person: Person, week: string) {
  const [top3Grid, ciGrid, weeklyGrid, scoresGrid, goalsGrid] = await sheets().batchGet([R.top3, R.checkins, R.weekly, R.scores, R.goals]);
  const top3 = parseTop3(top3Grid);
  const checkins = parseCheckIns(ciGrid);
  const weekly = parseWeekly(weeklyGrid);
  const scores = parseScores(scoresGrid).filter((s) => s.person === person);
  const { progress } = parseGoals(goalsGrid);
  const summary = weekSummary(person, week, top3, checkins, weekly);

  // Share of weekly goals marked Done, for past weeks that had goals.
  const byWeek = new Map<string, WeeklyGoal[]>();
  for (const g of weekly.filter((g) => g.person === person && g.week < week)) {
    byWeek.set(g.week, [...(byWeek.get(g.week) ?? []), g]);
  }
  const allWeeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, gs]) => ({ week: w, total: gs.length, pct: Math.round((gs.filter((g) => g.status === 'Done').length / gs.length) * 100) }));
  const year = week.slice(0, 4);
  const thisYear = allWeeks.filter((w) => w.week.startsWith(year));
  const average = thisYear.length ? Math.round(thisYear.reduce((s, w) => s + w.pct, 0) / thisYear.length) : null;
  const goalCounts = thisYear.map((w) => w.total).sort((a, b) => a - b);

  const nextWeek = addDays(week, 7);
  return {
    week,
    summary,
    trend: allWeeks.slice(-10),
    average,
    year,
    typicalGoals: goalCounts.length ? goalCounts[Math.floor(goalCounts.length / 2)] : null,
    lastScores: scores[scores.length - 1] ?? null,
    progress,
    nextWeek,
    nextWeekGoals: weekly.filter((g) => g.week === nextWeek && g.person === person),
    earliestWeek: weekly.filter((g) => g.person === person).reduce((m, g) => (g.week < m ? g.week : m), week),
  };
}

export async function loadGoals(date = todayIST()) {
  const [goalsGrid] = await sheets().batchGet([R.goals]);
  return { ...parseGoals(goalsGrid), daysLeft: Math.max(0, daysBetween(date, FY_END)) };
}

export async function loadMonthly() {
  const [monthlyGrid, goalsGrid] = await sheets().batchGet([R.monthly, R.goals]);
  return { months: parseMonthly(monthlyGrid), progress: parseGoals(goalsGrid).progress };
}

export async function loadVision(person: Person, date = todayIST()) {
  const [visionGrid, scoresGrid, ciGrid] = await sheets().batchGet([R.vision, R.scores, R.checkins]);
  const paragraphs = visionGrid.map((r) => cell(r, 0)).filter(Boolean);
  const questionIndex = paragraphs.findIndex((p) => /^today'?s question/i.test(p));
  const question =
    questionIndex >= 0
      ? paragraphs[questionIndex].replace(/^today'?s question:?\s*/i, '').replace(/^./, (c) => c.toUpperCase())
      : 'What is one thing I can do today that the 2029 version of me would do?';
  const text = paragraphs.filter((_, i) => i !== questionIndex);

  // Scoreboard lives in Vision!C1:E (Measure, Today, 2029).
  const board = visionGrid
    .map((r, i) => ({ row: i + 1, label: cell(r, 2), now: cell(r, 3), target: cell(r, 4) }))
    .filter((b, i) => i > 0 && b.label);

  const scores = parseScores(scoresGrid).filter((s) => s.person === person);
  const checkins = parseCheckIns(ciGrid).filter((c) => c.person === person);
  const streak = Array.from({ length: 9 }, (_, i) => addDays(date, i - 8)).map((d) => {
    const ci = checkins.find((c) => c.date === d);
    return { date: d, sunday: weekday(d) === 0, value: ci?.vision ?? '', hasCheckIn: !!ci };
  });
  const counted = streak.filter((s) => !s.sunday && (s.date !== date || s.hasCheckIn));

  return {
    text,
    question,
    board,
    lastScores: scores[scores.length - 1] ?? null,
    streak,
    streakYes: counted.filter((s) => s.value === 'Yes').length,
    streakDays: counted.length,
    month: monthKeyOf(date),
  };
}

/** For the Week page date picker and for writes. */
export { parseTop3, parseCheckIns, parseWeekly, parseScores, parseMonthly, parseGoals, R as RANGES };
