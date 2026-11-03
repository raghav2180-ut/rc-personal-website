/**
 * Kanban board: reads and writes the Board and BoardComments tabs.
 * Each person has their own board (the Owner column); nobody can read or
 * change another person's cards. Every write re-reads the card first.
 */
import { UserError } from './actions';
import {
  BOARD_HEADER,
  BOARD_RANGE,
  COMMENTS_HEADER,
  COMMENTS_RANGE,
  LABELS,
  cardRow,
  isListKey,
  newId,
  nowIso,
  parseBoard,
  parseComments,
  type Card,
  type ListKey,
} from './board-model';
import { FY_GOALS, parseTop3, RANGES } from './data';
import { isIso, todayIST } from './dates';
import type { Person } from './env';
import { sheets } from './sheets';

const RAW = { raw: true };

async function ensureTabs() {
  const s = sheets();
  await s.ensureTab('Board', BOARD_HEADER);
  await s.ensureTab('BoardComments', COMMENTS_HEADER);
  return s;
}

export async function loadBoard(owner: Person) {
  const s = await ensureTabs();
  const [boardGrid, commentGrid] = await s.batchGet([BOARD_RANGE, COMMENTS_RANGE]);
  const cards = parseBoard(boardGrid)
    .filter((c) => c.owner === owner)
    .sort((a, b) => a.pos - b.pos);
  const comments = parseComments(commentGrid).filter((c) => c.owner === owner);
  return { cards, comments };
}

// ------------------------------------------------------------------ writes ---

async function withCard(owner: Person, id: string) {
  const s = await ensureTabs();
  const [boardGrid] = await s.batchGet([BOARD_RANGE]);
  const all = parseBoard(boardGrid);
  const card = all.find((c) => c.id === id && c.owner === owner);
  if (!card) throw new UserError('That card was not found. Refresh and try again.');
  return { s, card, all };
}

async function save(s: ReturnType<typeof sheets>, card: Card) {
  card.updated = nowIso();
  const { row, ...rest } = card;
  await s.batchUpdate([{ range: `Board!A${row}:T${row}`, values: [cardRow(rest)] }], RAW);
}

const endOf = (all: Card[], owner: string, list: ListKey) =>
  all.filter((c) => c.owner === owner && c.list === list).reduce((m, c) => Math.max(m, c.pos), 0) + 1024;
const startOf = (all: Card[], owner: string, list: ListKey) =>
  all.filter((c) => c.owner === owner && c.list === list).reduce((m, c) => Math.min(m, c.pos), 1024) - 1024;

export async function createCard(owner: Person, list: string, title: string) {
  const t = title.trim();
  if (!t) throw new UserError('Give the card a title.');
  if (!isListKey(list)) throw new UserError('Unknown column.');
  const s = await ensureTabs();
  const [boardGrid] = await s.batchGet([BOARD_RANGE]);
  const all = parseBoard(boardGrid);
  const now = nowIso();
  const card: Omit<Card, 'row'> = {
    id: newId(), owner, list, pos: endOf(all, owner, list), title: t.slice(0, 500), desc: '', labels: [], start: '', due: '',
    dueDone: false, complete: false, checklists: [], attachments: [], fy: '', waiting: '', top3: '', created: now, updated: now,
    archivedFrom: '', trelloUrl: '',
  };
  await s.append('Board!A:T', [cardRow(card)], RAW);
  return card.id;
}

export interface DetailsInput {
  title: string;
  desc: string;
  labels: string[];
  start: string;
  due: string;
  dueTime: string;
  dueDone: boolean;
  fy: string;
  waiting: string;
}

export async function saveDetails(owner: Person, id: string, input: DetailsInput) {
  const title = input.title.trim();
  if (!title) throw new UserError('The title can’t be empty.');
  const { s, card } = await withCard(owner, id);
  card.title = title.slice(0, 500);
  card.desc = input.desc.slice(0, 20000);
  card.labels = input.labels.filter((l) => LABELS.some((x) => x.name === l));
  card.start = isIso(input.start) ? input.start : '';
  if (isIso(input.due)) {
    // Store a time with the date when one is given, in India time (+05:30).
    card.due = /^\d{2}:\d{2}$/.test(input.dueTime) ? new Date(`${input.due}T${input.dueTime}:00+05:30`).toISOString() : input.due;
  } else card.due = '';
  card.dueDone = !!card.due && input.dueDone;
  card.fy = FY_GOALS.includes(input.fy) || input.fy === card.fy ? input.fy : '';
  card.waiting = input.waiting.trim().slice(0, 120);
  await save(s, card);
}

/** Move a card to a column, optionally at an exact position (drag and drop). */
export async function moveCard(owner: Person, id: string, list: string, pos?: number | null) {
  if (!isListKey(list)) throw new UserError('Unknown column.');
  const { s, card, all } = await withCard(owner, id);
  if (list === 'archive' && card.list !== 'archive') card.archivedFrom = card.list;
  if (list !== 'archive') card.archivedFrom = '';
  card.pos = typeof pos === 'number' && Number.isFinite(pos) ? pos : list === 'done' ? startOf(all, owner, list) : endOf(all, owner, list);
  card.list = list;
  await save(s, card);
}

export async function restoreCard(owner: Person, id: string) {
  const { card } = await withCard(owner, id);
  const back = isListKey(card.archivedFrom) && card.archivedFrom !== 'archive' ? card.archivedFrom : 'someday';
  await moveCard(owner, id, back);
}

export async function toggleComplete(owner: Person, id: string) {
  const { s, card } = await withCard(owner, id);
  card.complete = !card.complete;
  await save(s, card);
}

export async function deleteCard(owner: Person, id: string) {
  const { s, card } = await withCard(owner, id);
  const [commentGrid] = await s.batchGet([COMMENTS_RANGE]);
  const blankCard = Array(BOARD_HEADER.length).fill('');
  const updates = [{ range: `Board!A${card.row}:T${card.row}`, values: [blankCard] }];
  for (const c of parseComments(commentGrid).filter((c) => c.card === id && c.owner === owner)) {
    updates.push({ range: `BoardComments!A${c.row}:F${c.row}`, values: [Array(COMMENTS_HEADER.length).fill('')] });
  }
  await s.batchUpdate(updates, RAW);
}

// --------------------------------------------------------------- checklists ---

export async function checklistAction(
  owner: Person,
  id: string,
  op: 'add-list' | 'delete-list' | 'add-item' | 'toggle-item' | 'delete-item' | 'edit-item',
  args: { list?: number; item?: number; text?: string },
) {
  const { s, card } = await withCard(owner, id);
  const text = (args.text ?? '').trim().slice(0, 1000);
  const list = args.list !== undefined ? card.checklists[args.list] : undefined;
  if (op !== 'add-list' && !list) throw new UserError('That checklist moved. Refresh and try again.');
  switch (op) {
    case 'add-list':
      card.checklists.push({ name: text || 'Checklist', items: [] });
      break;
    case 'delete-list':
      card.checklists.splice(args.list!, 1);
      break;
    case 'add-item':
      if (!text) throw new UserError('Write the item first.');
      list!.items.push([text, false]);
      break;
    case 'toggle-item':
    case 'delete-item':
    case 'edit-item': {
      const item = list!.items[args.item ?? -1];
      if (!item) throw new UserError('That item moved. Refresh and try again.');
      if (op === 'toggle-item') item[1] = !item[1];
      if (op === 'delete-item') list!.items.splice(args.item!, 1);
      if (op === 'edit-item') {
        if (!text) throw new UserError('The item can’t be empty.');
        item[0] = text;
      }
      break;
    }
  }
  await save(s, card);
}

// -------------------------------------------------------------------- links ---

export async function addLink(owner: Person, id: string, url: string, name: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
    if (!/^https?:$/.test(parsed.protocol)) throw new Error();
  } catch {
    throw new UserError('That doesn’t look like a web link (it should start with https://).');
  }
  const { s, card } = await withCard(owner, id);
  card.attachments.push({ name: name.trim().slice(0, 200) || parsed.href, url: parsed.href });
  await save(s, card);
}

export async function removeLink(owner: Person, id: string, index: number) {
  const { s, card } = await withCard(owner, id);
  if (!card.attachments[index]) throw new UserError('That link moved. Refresh and try again.');
  card.attachments.splice(index, 1);
  await save(s, card);
}

// ----------------------------------------------------------------- comments ---

export async function addComment(owner: Person, id: string, author: string, text: string) {
  const t = text.trim();
  if (!t) throw new UserError('Write the comment first.');
  const { s, card } = await withCard(owner, id);
  await s.append('BoardComments!A:F', [[newId(), id, owner, nowIso(), author, t.slice(0, 10000)]], RAW);
  await save(s, card);
}

export async function editComment(owner: Person, commentId: string, text: string) {
  const t = text.trim();
  if (!t) throw new UserError('The comment can’t be empty.');
  const s = await ensureTabs();
  const [grid] = await s.batchGet([COMMENTS_RANGE]);
  const c = parseComments(grid).find((x) => x.id === commentId && x.owner === owner);
  if (!c) throw new UserError('That comment was not found. Refresh and try again.');
  await s.batchUpdate([{ range: `BoardComments!F${c.row}`, values: [[t.slice(0, 10000)]] }], RAW);
}

export async function deleteComment(owner: Person, commentId: string) {
  const s = await ensureTabs();
  const [grid] = await s.batchGet([COMMENTS_RANGE]);
  const c = parseComments(grid).find((x) => x.id === commentId && x.owner === owner);
  if (!c) throw new UserError('That comment was not found. Refresh and try again.');
  await s.batchUpdate([{ range: `BoardComments!A${c.row}:F${c.row}`, values: [Array(COMMENTS_HEADER.length).fill('')] }], RAW);
}

// -------------------------------------------------------------- Make Top 3 ---

/** Add a Today card to today's Top 3 and remember the link, so ticking it done moves the card to Done. */
export async function makeTop3(owner: Person, id: string) {
  const { s, card } = await withCard(owner, id);
  const date = todayIST();
  if (card.top3.startsWith(`${date}#`)) throw new UserError('This card is already in today’s Top 3.');
  const [top3Grid] = await s.batchGet([RANGES.top3]);
  const today = parseTop3(top3Grid).filter((t) => t.date === date && t.person === owner);
  const n = today.reduce((m, t) => Math.max(m, t.n), 0) + 1;
  const task = n > 3 ? `${card.title} (bonus)` : card.title;
  const fy = FY_GOALS.includes(card.fy) ? card.fy : '';
  const safeTask = /^[=+\-@]/.test(task) ? `'${task}` : task;
  await s.append('Top3!A:F', [[date, owner, n, safeTask, '', fy]]);
  card.top3 = `${date}#${n}`;
  await save(s, card);
  return n;
}

/**
 * Called when a Top 3 task is ticked done or undone. Moves the linked board card
 * to Done (or back to Today). Never throws: the Top 3 save has already happened.
 */
export async function syncTop3ToBoard(owner: string, date: string, n: number, done: boolean) {
  try {
    const s = sheets();
    const [boardGrid] = await s.batchGet([BOARD_RANGE]);
    const all = parseBoard(boardGrid);
    const card = all.find((c) => c.owner === owner && c.top3 === `${date}#${n}`);
    if (!card) return;
    if (done && card.list !== 'done') {
      card.list = 'done';
      card.pos = startOf(all, owner, 'done');
      card.complete = true;
    } else if (!done && card.list === 'done') {
      card.list = 'today';
      card.pos = endOf(all, owner, 'today');
      card.complete = false;
    } else return;
    await save(s, card);
  } catch (err) {
    console.error('[life] board sync failed', err);
  }
}
