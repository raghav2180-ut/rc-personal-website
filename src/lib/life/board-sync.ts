/**
 * Keeps the board in step with the Top 3 and the weekly goals.
 *
 * Goals → board (syncBoard):
 *   - every Top 3 task for today has a card in Today, linked by "date#n" (Board P);
 *   - every weekly goal for this week has a card in This Week, linked by
 *     "week#row" (Board U), with the goal's FY area, a Saturday due date and
 *     its first step;
 *   - an open card with the same title is linked instead of making a duplicate;
 *   - titles follow the task or goal; done tasks and goals move their card to
 *     Done, and un-done ones move it back;
 *   - yesterday's unfinished Top 3 cards go back to This Week; last week's goals
 *     follow the Saturday review decision (Drop → Archive, Hand to → Waiting,
 *     Carry over → relinked to next week's goal);
 *   - a task or goal that was deleted archives its card.
 *
 * Board → goals (syncCardToGoals): moving a linked card into or out of Done, or
 * ticking it complete, updates the Top 3 task and the weekly goal to match.
 *
 * Both are safe to call often: they only write when something differs, and
 * they never throw, because the main save has already happened.
 */
import { BOARD_HEADER, BOARD_RANGE, cardRow, newId, nowIso, parseBoard, type Card, type ListKey } from './board-model';
import { FY_GOALS, parseTop3, parseWeekly, RANGES, type Top3Item, type WeeklyGoal } from './data';
import { addDays, todayIST, weekStart } from './dates';
import type { Person } from './env';
import { sheets } from './sheets';

const RAW = { raw: true };
const plain = (t: string) => t.replace(/\s*\(bonus\)\s*$/i, '').replace(/\s+/g, ' ').trim();
const same = (a: string, b: string) => plain(a).toLowerCase() === plain(b).toLowerCase();
const OPEN: ListKey[] = ['inbox', 'someday', 'waiting', 'week', 'today'];
const isDoneCard = (c: Card) => c.list === 'done' || c.complete;

export async function syncBoard(owner: Person, today = todayIST()) {
  try {
    const s = sheets();
    await s.ensureTab('Board', BOARD_HEADER);
    const [top3Grid, weeklyGrid, boardGrid] = await s.batchGet([RANGES.top3, RANGES.weekly, BOARD_RANGE]);
    const all = parseBoard(boardGrid);
    const cards = all.filter((c) => c.owner === owner);
    const tasks = parseTop3(top3Grid).filter((t) => t.person === owner && plain(t.task));
    const goals = parseWeekly(weeklyGrid).filter((g) => g.person === owner && g.goal.trim());
    const week = weekStart(today);
    const changed = new Set<Card>();
    const fresh: Card[] = [];
    const now = nowIso();

    const top = (list: ListKey) => [...cards, ...fresh].filter((c) => c.list === list).reduce((m, c) => Math.min(m, c.pos), 1024) - 1024;
    const end = (list: ListKey) => [...cards, ...fresh].filter((c) => c.list === list).reduce((m, c) => Math.max(m, c.pos), 0) + 1024;
    const move = (c: Card, list: ListKey) => {
      if (c.list === list) return;
      if (list === 'archive') c.archivedFrom = c.list;
      else c.archivedFrom = '';
      c.pos = list === 'done' ? top(list) : end(list);
      c.list = list;
      changed.add(c);
    };
    const set = <K extends keyof Card>(c: Card, k: K, v: Card[K]) => {
      if (c[k] === v) return;
      c[k] = v;
      changed.add(c);
    };
    const create = (partial: Partial<Card> & { title: string; list: ListKey }) => {
      const c: Card = {
        row: 0, id: newId(), owner, pos: partial.list === 'done' ? top('done') : end(partial.list), desc: '', labels: [], start: '', due: '',
        dueDone: false, complete: partial.list === 'done', checklists: [], attachments: [], fy: '', waiting: '', top3: '', created: now,
        updated: now, archivedFrom: '', trelloUrl: '', weekly: '', ...partial,
      };
      fresh.push(c);
      cards.push(c);
      return c;
    };
    /** An open card with this title that isn't already tied to something current. */
    const unlinked = (title: string, free: (c: Card) => boolean) =>
      cards.find((c) => OPEN.includes(c.list) && !c.complete && free(c) && same(c.title, title));

    // ------------------------------------------------ weekly goals → This Week
    const liveGoal = new Map<string, WeeklyGoal>(goals.map((g) => [`${g.week}#${g.row}`, g]));
    for (const g of goals.filter((x) => x.week === week)) {
      const link = `${g.week}#${g.row}`;
      const done = g.status === 'Done';
      let c = cards.find((x) => x.weekly === link);
      // A carried-over goal picks up last week's card, so its history stays together.
      c ??= unlinked(g.goal, (x) => !x.weekly || x.weekly.split('#')[0] < week);
      if (!c) {
        c = create({
          title: g.goal.trim().slice(0, 500), list: done ? 'done' : 'week', weekly: link, fy: FY_GOALS.includes(g.fy) ? g.fy : '',
          due: addDays(week, 5), desc: g.firstStep ? `First step: ${g.firstStep}` : '',
        });
        continue;
      }
      set(c, 'weekly', link);
      set(c, 'title', g.goal.trim().slice(0, 500));
      if (!c.due) set(c, 'due', addDays(week, 5));
      if (!c.fy && FY_GOALS.includes(g.fy)) set(c, 'fy', g.fy);
    }

    // ----------------------------------------------------- Top 3 → Today
    const todays = tasks.filter((t) => t.date === today);
    const liveTask = new Map<string, Top3Item>(tasks.map((t) => [`${t.date}#${t.n}`, t]));
    for (const t of todays) {
      const link = `${t.date}#${t.n}`;
      let c = cards.find((x) => x.top3 === link);
      c ??= unlinked(t.task, (x) => !x.top3.startsWith(`${today}#`));
      if (!c) {
        c = create({ title: plain(t.task).slice(0, 500), list: t.done === 'Yes' ? 'done' : 'today', top3: link, fy: FY_GOALS.includes(t.fy) ? t.fy : '' });
        continue;
      }
      set(c, 'top3', link);
      // Keep the card's title for a weekly-goal card picked as a Top 3; otherwise follow the task.
      if (!c.weekly) set(c, 'title', plain(t.task).slice(0, 500));
      if (t.done !== 'Yes' && OPEN.includes(c.list) && c.list !== 'today') move(c, 'today');
    }

    // ------------------------------------------------- done / not done, cleanup
    for (const c of cards) {
      if (c.list === 'archive') continue;
      const task = c.top3 ? liveTask.get(c.top3) : undefined;
      const goal = c.weekly ? liveGoal.get(c.weekly) : undefined;
      const taskDate = c.top3.split('#')[0];
      const goalWeek = c.weekly.split('#')[0];

      const currentTask = !!c.top3 && taskDate === today;
      const currentGoal = !!c.weekly && goalWeek === week;

      // Deleted in the sheet: drop the link, and archive the card if nothing else holds it.
      if (currentTask && !task) {
        set(c, 'top3', '');
        if (!goal) move(c, 'archive');
        continue;
      }
      if (currentGoal && !goal) {
        set(c, 'weekly', '');
        if (!(currentTask && task)) move(c, 'archive');
        continue;
      }
      if (task?.done === 'Yes' || goal?.status === 'Done') {
        move(c, 'done');
        set(c, 'complete', true);
        continue;
      }
      // Un-ticked today or this week: back out of Done.
      if (c.list === 'done' && ((currentTask && task) || (currentGoal && goal))) {
        move(c, currentTask && task ? 'today' : 'week');
        set(c, 'complete', false);
        continue;
      }
      // An earlier day's unfinished Top 3 leaves Today for This Week.
      if (c.list === 'today' && task && taskDate < today) {
        move(c, 'week');
        continue;
      }
      // Last week's goals follow the Saturday review decision (Carry over is relinked above).
      if (goal && goalWeek < week && OPEN.includes(c.list) && !currentTask) {
        if (/^drop/i.test(goal.next)) move(c, 'archive');
        else if (/^hand to/i.test(goal.next)) {
          move(c, 'waiting');
          set(c, 'waiting', goal.next.replace(/^hand to:?\s*/i, '').trim());
        }
      }
    }

    // ------------------------------------------------------------- write
    const updates = [...changed].filter((c) => c.row > 0);
    if (updates.length) {
      await s.batchUpdate(
        updates.map((c) => {
          c.updated = now;
          const { row, ...rest } = c;
          return { range: `Board!A${row}:U${row}`, values: [cardRow(rest)] };
        }),
        RAW,
      );
    }
    if (fresh.length) await s.append('Board!A:U', fresh.map(({ row, ...rest }) => cardRow(rest)), RAW);
  } catch (err) {
    console.error('[life] board sync failed', err);
  }
}

/** A linked card moved into or out of Done on the board: update its Top 3 task and weekly goal. */
export async function syncCardToGoals(owner: Person, before: Pick<Card, 'list' | 'complete'>, card: Card) {
  const wasDone = before.list === 'done' || before.complete;
  const nowDone = isDoneCard(card);
  if (wasDone === nowDone || (!card.top3 && !card.weekly)) return;
  try {
    const s = sheets();
    const [top3Grid, weeklyGrid] = await s.batchGet([RANGES.top3, RANGES.weekly]);
    if (card.weekly) {
      const [week, row] = card.weekly.split('#');
      const g = parseWeekly(weeklyGrid).find((x) => x.row === Number(row) && x.week === week && x.person === owner);
      if (g && nowDone && g.status !== 'Done') await s.batchUpdate([{ range: `Weekly!E${g.row}`, values: [['Done']] }]);
      if (g && !nowDone && g.status === 'Done') await s.batchUpdate([{ range: `Weekly!E${g.row}`, values: [['In progress']] }]);
    }
    if (card.top3) {
      const [date, n] = card.top3.split('#');
      const t = parseTop3(top3Grid).find((x) => x.date === date && x.n === Number(n) && x.person === owner);
      if (t && (nowDone ? t.done !== 'Yes' : t.done === 'Yes')) {
        const { setTop3Done } = await import('./actions');
        await setTop3Done({ row: t.row, date, person: owner, done: nowDone ? 'Yes' : '' });
      }
    }
  } catch (err) {
    console.error('[life] card → goals sync failed', err);
  }
}
