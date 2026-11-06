/**
 * Goals: FY and quarter goal tables in the sheet's Goals tab.
 *
 * Each table starts with a heading row that names its period and deadline, e.g.
 *   "1. FY 2026–27 goals (by 31 Mar 2027) — …"
 *   "2. Q3 goals (Oct–Dec 2026, by 31 Dec 2026) — …"
 * then a header row (Area, Owner, Goal, Baseline, Current, Target, % done,
 * Milestones, Revenue link, Notes), then one row per goal, ending at a blank row.
 *
 * Nothing about the year is hard-coded: the page picks the table whose period
 * contains today, so a new quarter or FY only needs its table added, which the
 * Goals page does through its "Set goals" form. Quarters follow the Indian FY:
 * Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
 */
import { UserError, text } from './actions';
import { addDays, daysBetween, todayIST } from './dates';
import type { Person } from './env';
import { sheets, type Grid } from './sheets';

const RANGE = 'Goals!A1:L';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`; // m is 1-based
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const colLetter = (i: number) => String.fromCharCode(65 + i);

export type Kind = 'FY' | 'Q' | 'M';

// ----------------------------------------------------------- periods ---

export interface PeriodKey {
  kind: Kind;
  fy: string; // "2026–27"
  q: number | null;
  m: number | null; // month (1–12) for a month's goals
  start: string;
  end: string;
}

export function fyOf(date: string): PeriodKey {
  const [y, m] = date.split('-').map(Number);
  const s = m >= 4 ? y : y - 1;
  return { kind: 'FY', fy: `${s}–${pad((s + 1) % 100)}`, q: null, m: null, start: iso(s, 4, 1), end: iso(s + 1, 3, 31) };
}

export function quarterOf(date: string): PeriodKey {
  const [y, m] = date.split('-').map(Number);
  const q = m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4;
  const sm = [4, 7, 10, 1][q - 1];
  const em = sm + 2;
  return { kind: 'Q', fy: fyOf(date).fy, q, m: null, start: iso(y, sm, 1), end: iso(y, em, lastDay(y, em)) };
}

export function monthOf(date: string): PeriodKey {
  const [y, m] = date.split('-').map(Number);
  return { kind: 'M', fy: fyOf(date).fy, q: quarterOf(date).q, m, start: iso(y, m, 1), end: iso(y, m, lastDay(y, m)) };
}

/** "FY 2026–27" or "Q3" */
export const periodLabel = (p: PeriodKey) => (p.kind === 'FY' ? `FY ${p.fy}` : p.kind === 'Q' ? `Q${p.q}` : `${MON[p.m! - 1]} ${p.start.slice(0, 4)}`);
/** "Oct–Dec 2026" */
export function monthsLabel(p: PeriodKey): string {
  if (p.kind === 'M') return periodLabel(p);
  const [sy, sm] = p.start.split('-').map(Number);
  const [ey, em] = p.end.split('-').map(Number);
  return sy === ey ? `${MON[sm - 1]}–${MON[em - 1]} ${ey}` : `${MON[sm - 1]} ${sy}–${MON[em - 1]} ${ey}`;
}
/** "31 Mar 2027" */
export function longDay(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MON[m - 1]} ${y}`;
}
const samePeriod = (a: PeriodKey, b: PeriodKey) => a.kind === b.kind && a.fy === b.fy && a.q === b.q && a.m === b.m;

// ------------------------------------------------------------- parsing ---

export interface Goal {
  row: number;
  area: string;
  owner: string;
  goal: string;
  baseline: number | null;
  current: number | null;
  target: number | null;
  milestones: string;
  revenue: string;
  notes: string;
  done: boolean; // for goals without a number: Current says "Done"
}

type Col = 'area' | 'owner' | 'goal' | 'baseline' | 'current' | 'target' | 'pct' | 'milestones' | 'revenue' | 'notes';

export interface Table extends PeriodKey {
  titleRow: number;
  headerRow: number;
  lastRow: number; // last goal row, or the header row if there are none
  cols: Partial<Record<Col, number>>;
  goals: Goal[];
}

const COL_TESTS: [Col, RegExp][] = [
  ['area', /^area/i],
  ['owner', /^owner/i],
  ['current', /^current/i],
  ['target', /^target/i],
  ['pct', /%/],
  ['baseline', /baseline|start/i],
  ['revenue', /revenue/i],
  ['notes', /^notes/i],
  ['milestones', /milestone|pace|plan/i],
  ['goal', /goal/i],
];

const cell = (r: string[] | undefined, i: number | undefined) => (i === undefined ? '' : (r?.[i] ?? '').toString().trim());
function numOrNull(v: string): number | null {
  if (v === '') return null;
  const n = Number(v.replace(/[₹,\sL]/gi, ''));
  return Number.isFinite(n) ? n : null;
}

/** A heading row: "… goals (… by 31 Dec 2026)". */
function titlePeriod(a: string): PeriodKey | null {
  if (!/goals?\b/i.test(a)) return null;
  const m = /\bby\s+(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/i.exec(a);
  if (!m) return null;
  const mi = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return null;
  const end = iso(Number(m[3]), mi + 1, Number(m[1]));
  if (/\bQ[1-4]\b/i.test(a)) return quarterOf(end);
  if (/\bFY\b/i.test(a)) return fyOf(end);
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\s+goals/i.test(a)) return monthOf(end);
  return null;
}

export function parseTables(grid: Grid): Table[] {
  const out: Table[] = [];
  for (let i = 0; i < grid.length; i++) {
    const p = titlePeriod(cell(grid[i], 0));
    if (!p) continue;
    const header = grid[i + 1] ?? [];
    const cols: Partial<Record<Col, number>> = {};
    header.forEach((h, j) => {
      const t = (h ?? '').toString().trim();
      if (!t) return;
      const hit = COL_TESTS.find(([k, re]) => cols[k] === undefined && re.test(t));
      if (hit) cols[hit[0]] = j;
    });
    const goals: Goal[] = [];
    let last = i + 2; // 1-based header row
    for (let r = i + 2; r < grid.length; r++) {
      const row = grid[r];
      if (titlePeriod(cell(row, 0))) break;
      const area = cell(row, cols.area);
      const goal = cell(row, cols.goal);
      if (!area && !goal) break;
      if (!goal) continue;
      last = r + 1;
      goals.push({
        row: r + 1,
        area,
        owner: cell(row, cols.owner),
        goal,
        baseline: numOrNull(cell(row, cols.baseline)),
        current: numOrNull(cell(row, cols.current)),
        target: numOrNull(cell(row, cols.target)),
        milestones: cell(row, cols.milestones),
        revenue: cell(row, cols.revenue),
        notes: cell(row, cols.notes),
        done: /^(done|yes|✓)$/i.test(cell(row, cols.current)),
      });
    }
    out.push({ ...p, titleRow: i + 1, headerRow: i + 2, lastRow: last, cols, goals });
  }
  return out;
}

const isKajol = (owner: string) => /^\s*kajol\s*$/i.test(owner);
/** Raghav sees the company goals; Kajol sees only goals she owns. */
export const isMine = (person: Person, g: Goal) => (person === 'Kajol' ? /kajol/i.test(g.owner) : !isKajol(g.owner));

// ---------------------------------------------------------- display ---

export const isMoney = (g: Goal) => /revenue|₹/i.test(g.area);
export const fmt = (g: Goal, v: number | null) => (v === null ? '–' : isMoney(g) ? `₹${Number(v.toFixed(2))}L` : String(Number(v.toFixed(2))));
export const pct = (g: Goal) => (g.current !== null && g.target ? Math.round((g.current / g.target) * 100) : null);

/** What it takes to hit the target in the time left. */
export function pace(g: Goal, t: PeriodKey, today: string): string {
  if (g.target === null) return '';
  const left = g.target - (g.current ?? 0);
  if (left <= 0) return 'Target reached. Hold it there.';
  const days = Math.max(daysBetween(today, t.end), 1);
  if (isMoney(g)) {
    // "₹10L a month" goals are a rate; "₹30L in Oct–Dec" goals are a total.
    if (/month/i.test(`${g.area} ${g.goal}`) && t.kind === 'FY') return `Gap: ₹${Number(left.toFixed(2))}L a month`;
    return `Need ₹${Number((left / Math.max(days / 30.4, 1)).toFixed(1))}L a month`;
  }
  const perWeek = left / Math.max(days / 7, 1);
  const n = Number(left.toFixed(2));
  if (perWeek >= 0.9) return `${n} to go · about ${Number(perWeek.toFixed(1))} a week`;
  if (t.kind === 'M' || days <= 31) return `${n} to go · ${Math.max(1, Math.round(days / 7))} weeks left`;
  if (perWeek * 4.35 >= 1) return `${n} to go · about ${Math.round(perWeek * 4.35)} a month`;
  return `${Number(left.toFixed(2))} to go · about 1 every ${Math.round(1 / perWeek)} weeks`;
}

export interface Milestone {
  text: string;
  done: boolean;
  due: string | null;
}

/** "Root-cause by 30 Nov; take over ops by 30 Nov" → dated steps. A done step starts with ✓. */
export function milestones(text: string, t: PeriodKey): Milestone[] {
  return text
    .split(/;\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const done = s.startsWith('✓');
      const body = s.replace(/^✓\s*/, '');
      const m = /\bby\s+(\d{1,2})\s+([A-Za-z]{3})/i.exec(body);
      let due: string | null = null;
      if (m) {
        const mi = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
        if (mi >= 0) {
          let y = Number(t.start.slice(0, 4));
          if (iso(y, mi + 1, 1) < t.start.slice(0, 8) + '01') y += 1;
          due = iso(y, mi + 1, Math.min(Number(m[1]), lastDay(y, mi + 1)));
        }
      }
      return { text: body, done, due };
    });
}

// ------------------------------------------------------------- loading ---

export interface SetupPrompt extends PeriodKey {
  label: string;
  months: string;
  why: string; // "Q3 ends in 9 days" / "Q4 has started"
  urgent: boolean;
  rows: { area: string; owner: string; goal: string; baseline: string }[];
}

function prefill(person: Person, kind: Kind, tables: Table[]): SetupPrompt['rows'] {
  const mine = (t: Table) => t.goals.filter((g) => isMine(person, g));
  const pastFy = tables.filter((t) => t.kind === 'FY').sort((a, b) => a.end.localeCompare(b.end)).pop();
  const pastQ = tables.filter((t) => t.kind === 'Q').sort((a, b) => a.end.localeCompare(b.end)).pop();
  if (kind === 'FY' && pastFy) {
    // A new FY starts where the last one ended.
    return mine(pastFy).map((g) => ({ area: g.area, owner: g.owner, goal: '', baseline: g.current === null ? '' : String(g.current) }));
  }
  if (kind === 'Q' && pastQ && mine(pastQ).length) return mine(pastQ).map((g) => ({ area: g.area, owner: g.owner, goal: g.goal, baseline: '0' }));
  const pastM = tables.filter((t) => t.kind === 'M').sort((a, b) => a.end.localeCompare(b.end)).pop();
  if (kind === 'M' && pastM && mine(pastM).length) return mine(pastM).map((g) => ({ area: g.area, owner: g.owner, goal: g.goal, baseline: g.target !== null ? '0' : '' }));
  if (kind === 'M' && pastQ && mine(pastQ).length) return mine(pastQ).map((g) => ({ area: g.area, owner: g.owner, goal: '', baseline: g.target !== null ? '0' : '' }));
  if (kind === 'Q' && pastFy) return mine(pastFy).filter((g) => g.target !== null).map((g) => ({ area: g.area, owner: g.owner, goal: '', baseline: '0' }));
  return [];
}

export async function loadGoalsPage(person: Person, today = todayIST()) {
  const [grid] = await sheets().batchGet([RANGE]);
  const tables = parseTables(grid);
  const mineOf = (t: Table | undefined) => (t ? t.goals.filter((g) => isMine(person, g)) : []);
  const fyKey = fyOf(today);
  const qKey = quarterOf(today);
  const fy = tables.find((t) => samePeriod(t, fyKey));
  const quarter = tables.find((t) => samePeriod(t, qKey));
  const mKey = monthOf(today);
  const month = tables.find((t) => samePeriod(t, mKey));
  const pastMonths = tables.filter((t) => t.kind === 'M' && t.fy === fyKey.fy && t.end < today && mineOf(t).length).sort((a, b) => a.end.localeCompare(b.end));
  const pastQuarters = tables.filter((t) => t.kind === 'Q' && t.fy === fyKey.fy && t.end < today && mineOf(t).length).sort((a, b) => a.end.localeCompare(b.end));
  const lastFy = tables.filter((t) => t.kind === 'FY' && t.end < today && mineOf(t).length).sort((a, b) => a.end.localeCompare(b.end)).pop();

  // What needs setting up: this period if it's missing, the next one in its last stretch.
  const prompts: SetupPrompt[] = [];
  const add = (k: PeriodKey, why: string, urgent: boolean) => {
    if (mineOf(tables.find((t) => samePeriod(t, k))).length) return;
    prompts.push({ ...k, label: periodLabel(k), months: monthsLabel(k), why, urgent, rows: prefill(person, k.kind, tables) });
  };
  add(fyKey, `${periodLabel(fyKey)} has started`, true);
  const nextFy = fyOf(addDays(fyKey.end, 1));
  if (daysBetween(today, fyKey.end) <= 31) add(nextFy, `${periodLabel(fyKey)} ends in ${daysBetween(today, fyKey.end)} days`, false);
  // Quarter goals are Raghav's company rhythm; Kajol adds hers with "+ Add a goal".
  if (person === 'Raghav') {
    add(qKey, `${periodLabel(qKey)} has started`, true);
    const nextQ = quarterOf(addDays(qKey.end, 1));
    if (daysBetween(today, qKey.end) <= 14) add(nextQ, `${periodLabel(qKey)} ends in ${daysBetween(today, qKey.end)} days`, false);
    add(mKey, `${periodLabel(mKey)} has started`, true);
    const nextM = monthOf(addDays(mKey.end, 1));
    if (daysBetween(today, mKey.end) <= 6) add(nextM, `${periodLabel(mKey)} ends in ${daysBetween(today, mKey.end)} days`, false);
  }

  return {
    today,
    fyKey,
    qKey,
    mKey,
    month: month ? { ...month, goals: mineOf(month) } : null,
    pastMonths: pastMonths.map((t) => ({ ...t, goals: mineOf(t) })),
    fy: fy ? { ...fy, goals: mineOf(fy) } : null,
    quarter: quarter ? { ...quarter, goals: mineOf(quarter) } : null,
    pastQuarters: pastQuarters.map((t) => ({ ...t, goals: mineOf(t) })),
    lastFy: lastFy && !fy?.goals.some((g) => isMine(person, g)) ? { ...lastFy, goals: mineOf(lastFy) } : null,
    prompts,
  };
}

/** FY numbers for the Monthly log: the company goals with a target, in this FY's table. */
export function fyProgress(grid: Grid, today = todayIST()) {
  const fy = parseTables(grid).find((t) => samePeriod(t, fyOf(today)));
  return (fy?.goals ?? [])
    .filter((g) => !isKajol(g.owner) && g.target !== null)
    .map((g) => ({ row: g.row, label: g.area, current: g.current ?? 0, target: g.target!, pct: pct(g) ?? 0 }));
}
export const GOALS_RANGE = RANGE;

// -------------------------------------------------------------- saving ---

async function findGoal(person: Person, row: number, goalText: string) {
  const s = sheets();
  const [grid] = await s.batchGet([RANGE]);
  for (const t of parseTables(grid)) {
    const g = t.goals.find((x) => x.row === row);
    if (!g) continue;
    if (g.goal !== goalText.trim()) break;
    if (!isMine(person, g)) throw new UserError('That goal isn’t yours to change.');
    return { s, t, g };
  }
  throw new UserError('That goal moved in the sheet. Refresh and try again.');
}

export async function setCurrent(person: Person, row: number, goalText: string, value: number | null) {
  const { s, t } = await findGoal(person, row, goalText);
  if (t.cols.current === undefined) throw new UserError('This table has no Current column.');
  await s.batchUpdate([{ range: `Goals!${colLetter(t.cols.current)}${row}`, values: [[value === null ? '' : value]] }]);
}

/** A goal without a number is ticked off by writing "Done" in its Current cell. */
export async function toggleGoalDone(person: Person, row: number, goalText: string) {
  const { s, t, g } = await findGoal(person, row, goalText);
  if (g.target !== null) throw new UserError('This goal has a number. Use Update instead.');
  if (t.cols.current === undefined) throw new UserError('This table has no Current column.');
  await s.batchUpdate([{ range: `Goals!${colLetter(t.cols.current)}${row}`, values: [[g.done ? '' : 'Done']] }]);
  return !g.done;
}

export async function toggleMilestone(person: Person, row: number, goalText: string, index: number) {
  const { s, t, g } = await findGoal(person, row, goalText);
  if (t.cols.milestones === undefined) throw new UserError('This table has no milestones column.');
  const parts = g.milestones.split(/;\s*|\n+/).map((x) => x.trim()).filter(Boolean);
  if (index < 0 || index >= parts.length) throw new UserError('That step moved. Refresh and try again.');
  parts[index] = parts[index].startsWith('✓') ? parts[index].replace(/^✓\s*/, '') : `✓ ${parts[index]}`;
  await s.batchUpdate([{ range: `Goals!${colLetter(t.cols.milestones)}${row}`, values: [[text(parts.join('; '))]] }]);
}

export interface NewGoal {
  area: string;
  owner: string;
  goal: string;
  baseline: number | null;
  target: number | null;
  milestones: string;
}

/** Add goals to a period's table, creating the table at the bottom of the tab if it doesn't exist yet. */
export async function addGoals(person: Person, period: { kind: Kind; fy: string; q: number | null; m?: number | null }, input: NewGoal[]) {
  const rows = input.filter((g) => g.goal.trim());
  if (!rows.length) throw new UserError('Write at least one goal.');
  for (const g of rows) {
    if (person === 'Kajol') g.owner = 'Kajol';
    else if (!g.owner.trim()) g.owner = 'Raghav';
    else if (isKajol(g.owner)) throw new UserError('Kajol adds her own goals from her login.');
    if (g.target !== null && g.target <= 0) throw new UserError(`The target for “${g.goal.slice(0, 50)}” should be above 0.`);
  }
  if (!/^\d{4}–\d{2}$/.test(period.fy) || (period.kind === 'Q' && !(period.q! >= 1 && period.q! <= 4)) || (period.kind === 'M' && !(period.m! >= 1 && period.m! <= 12))) throw new UserError('Unknown period. Refresh and try again.');

  // Work out the period's dates from its FY and quarter.
  const fyStartYear = Number(period.fy.slice(0, 4));
  const key: PeriodKey =
    period.kind === 'FY'
      ? fyOf(iso(fyStartYear, 4, 1))
      : period.kind === 'M'
      ? monthOf(iso(period.m! >= 4 ? fyStartYear : fyStartYear + 1, period.m!, 1))
      : quarterOf(iso(period.q === 4 ? fyStartYear + 1 : fyStartYear, [4, 7, 10, 1][period.q! - 1], 1));

  const s = sheets();
  const [grid] = await s.batchGet([RANGE]);
  const tables = parseTables(grid);
  const existing = tables.find((t) => samePeriod(t, key));

  const rowValues = (cols: Table['cols'], r: number, g: NewGoal) => {
    const width = Math.max(...Object.values(cols).map((c) => c ?? 0)) + 1;
    const out: (string | number)[] = Array(width).fill('');
    const put = (c: Col, v: string | number) => {
      if (cols[c] !== undefined) out[cols[c]!] = v;
    };
    put('area', text(g.area));
    put('owner', text(g.owner));
    put('goal', text(g.goal));
    if (g.baseline !== null) put('baseline', g.baseline);
    if (g.target !== null) {
      put('current', g.baseline ?? 0);
      put('target', g.target);
      if (cols.pct !== undefined && cols.current !== undefined && cols.target !== undefined) {
        const e = `${colLetter(cols.current)}${r}`;
        const f = `${colLetter(cols.target)}${r}`;
        put('pct', `=IF(OR(${e}="",${f}=""),"",${e}/${f})`);
      }
    }
    put('milestones', text(g.milestones));
    return out;
  };
  const lastCol = (cols: Table['cols']) => colLetter(Math.max(...Object.values(cols).map((c) => c ?? 0)));

  if (existing) {
    // Make room right under the table's last goal so the next table isn't overwritten.
    await s.insertRows('Goals', existing.lastRow, rows.length);
    await s.batchUpdate(
      rows.map((g, i) => {
        const r = existing.lastRow + 1 + i;
        return { range: `Goals!A${r}:${lastCol(existing.cols)}${r}`, values: [rowValues(existing.cols, r, g)] };
      }),
    );
    return;
  }

  // A new table two rows under the last used row, numbered after the others.
  let used = grid.length;
  while (used > 0 && !(grid[used - 1] ?? []).some((c) => (c ?? '').toString().trim())) used--;
  const n = grid.reduce((m, r) => Math.max(m, Number(/^(\d+)\./.exec(cell(r, 0))?.[1] ?? 0)), 0) + 1;
  const titleRow = used + 2;
  const deadline = longDay(key.end);
  const [, sm] = key.start.split('-').map(Number);
  const title =
    key.kind === 'FY' || key.kind === 'M'
      ? `${n}. ${periodLabel(key)} goals (by ${deadline}) — update Current on the Goals page`
      : `${n}. ${periodLabel(key)} goals (${monthsLabel(key)}, by ${deadline}) — update Current on the Goals page`;
  const header =
    key.kind === 'M'
      ? ['Area', 'Owner', `${periodLabel(key)} goal (by ${deadline})`, `Start of ${MON[sm - 1]} (1 ${MON[sm - 1]})`, 'Current', 'Target', '% done', 'Plan / steps', 'Revenue link', 'Notes']
      : key.kind === 'FY'
      ? ['Area', 'Owner', `Goal (by ${deadline})`, `Baseline (${MON[sm - 1]} ${key.start.slice(0, 4)})`, 'Current', 'Target', '% done', 'Milestones / targets', 'Revenue link', 'Notes']
      : ['Area', 'Owner', `${periodLabel(key)} goal (by ${deadline})`, `Start of ${periodLabel(key)} (1 ${MON[sm - 1]})`, 'Current', 'Target', '% done', 'Monthly pace / plan', 'Revenue link', 'Notes'];
  const cols: Table['cols'] = { area: 0, owner: 1, goal: 2, baseline: 3, current: 4, target: 5, pct: 6, milestones: 7, revenue: 8, notes: 9 };
  await s.batchUpdate([
    { range: `Goals!A${titleRow}`, values: [[title]] },
    { range: `Goals!A${titleRow + 1}:J${titleRow + 1}`, values: [header] },
    ...rows.map((g, i) => {
      const r = titleRow + 2 + i;
      return { range: `Goals!A${r}:J${r}`, values: [rowValues(cols, r, g)] };
    }),
  ]);
}
