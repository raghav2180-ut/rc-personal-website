/**
 * The Kanban board's shape: columns, labels, and how a card maps to a sheet row.
 * Pure functions only (no sheet calls), so any module can import it.
 *
 * Sheet layout
 *   Board          A ID | B Owner | C List | D Position | E Title | F Description | G Labels
 *                  H Start | I Due | J Due complete | K Complete | L Checklists (JSON) | M Attachments (JSON)
 *                  N FY goal | O Waiting on | P Top 3 (date#n) | Q Created | R Updated | S Archived from | T Trello URL
 *   BoardComments  A ID | B Card ID | C Owner | D Date | E Author | F Text
 */
import { cellToIso } from './dates';
import type { Grid } from './sheets';

export const BOARD_RANGE = 'Board!A2:T';
export const COMMENTS_RANGE = 'BoardComments!A2:F';
export const BOARD_HEADER = [
  'ID', 'Owner', 'List', 'Position', 'Title', 'Description', 'Labels', 'Start', 'Due', 'Due complete', 'Complete',
  'Checklists', 'Attachments', 'FY goal', 'Waiting on', 'Top 3', 'Created', 'Updated', 'Archived from', 'Trello URL',
];
export const COMMENTS_HEADER = ['ID', 'Card ID', 'Owner', 'Date', 'Author', 'Text'];

export const LISTS = [
  { key: 'inbox', name: 'Inbox', emoji: '📥' },
  { key: 'someday', name: 'Someday', emoji: '📅' },
  { key: 'waiting', name: 'Waiting', emoji: '⏳' },
  { key: 'week', name: 'This Week', emoji: '🎯' },
  { key: 'today', name: 'Today', emoji: '🔥' },
  { key: 'done', name: 'Done', emoji: '✅' },
  { key: 'archive', name: 'Archive', emoji: '🗂️' },
] as const;
export type ListKey = (typeof LISTS)[number]['key'];
export const isListKey = (v: unknown): v is ListKey => LISTS.some((l) => l.key === v);
export const listName = (key: string) => {
  const l = LISTS.find((x) => x.key === key);
  return l ? `${l.emoji} ${l.name.toUpperCase()}` : key;
};

/** Same labels and colours as the Trello board. */
export const LABELS = [
  { name: 'Deep Work', color: '#4BCE97', ink: '#164B35' },
  { name: 'Non Deep Work', color: '#F87168', ink: '#5D1F1A' },
  { name: 'Reactive Work', color: '#F5CD47', ink: '#533F04' },
];
export const labelStyle = (name: string) => LABELS.find((l) => l.name === name) ?? { name, color: '#DCDFE4', ink: '#172033' };

export type ChecklistItem = [text: string, done: boolean];
export interface Checklist {
  name: string;
  items: ChecklistItem[];
}
export interface Attachment {
  name: string;
  url: string;
}

export interface Card {
  row: number;
  id: string;
  owner: string;
  list: ListKey;
  pos: number;
  title: string;
  desc: string;
  labels: string[];
  start: string; // YYYY-MM-DD
  due: string; // ISO date-time or YYYY-MM-DD
  dueDone: boolean;
  complete: boolean;
  checklists: Checklist[];
  attachments: Attachment[];
  fy: string;
  waiting: string;
  top3: string; // "2026-11-03#4"
  created: string;
  updated: string;
  archivedFrom: string;
  trelloUrl: string;
}

export interface Comment {
  row: number;
  id: string;
  card: string;
  owner: string;
  date: string;
  author: string;
  text: string;
}

const cell = (row: string[] | undefined, i: number) => (row?.[i] ?? '').toString();

function json<T>(raw: string, fallback: T): T {
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseBoard(grid: Grid): Card[] {
  return grid
    .map((r, i): Card | null => {
      const id = cell(r, 0).trim();
      const title = cell(r, 4);
      if (!id || !title.trim()) return null;
      const list = cell(r, 2).trim();
      return {
        row: i + 2,
        id,
        owner: cell(r, 1).trim(),
        list: isListKey(list) ? list : 'inbox',
        pos: Number(cell(r, 3)) || 0,
        title,
        desc: cell(r, 5),
        labels: cell(r, 6).split(',').map((s) => s.trim()).filter(Boolean),
        start: cellToIso(cell(r, 7)) ?? cell(r, 7).trim(),
        due: /^\d{5}(\.\d+)?$/.test(cell(r, 8).trim()) ? cellToIso(cell(r, 8)) ?? '' : cell(r, 8).trim(),
        dueDone: /^y/i.test(cell(r, 9)),
        complete: /^y/i.test(cell(r, 10)),
        checklists: json<Checklist[]>(cell(r, 11), []).map((c) => ({ name: String(c.name ?? 'Checklist'), items: (c.items ?? []).map((it) => [String(it[0]), !!it[1]] as ChecklistItem) })),
        attachments: json<Attachment[]>(cell(r, 12), []),
        fy: cell(r, 13).trim(),
        waiting: cell(r, 14).trim(),
        top3: cell(r, 15).trim(),
        created: cell(r, 16).trim(),
        updated: cell(r, 17).trim(),
        archivedFrom: cell(r, 18).trim(),
        trelloUrl: cell(r, 19).trim(),
      };
    })
    .filter((c): c is Card => !!c);
}

export function parseComments(grid: Grid): Comment[] {
  return grid
    .map((r, i): Comment | null => {
      const id = cell(r, 0).trim();
      if (!id || !cell(r, 1).trim()) return null;
      return { row: i + 2, id, card: cell(r, 1).trim(), owner: cell(r, 2).trim(), date: cell(r, 3).trim(), author: cell(r, 4), text: cell(r, 5) };
    })
    .filter((c): c is Comment => !!c);
}

/** Board rows are written with valueInputOption RAW, so text is stored exactly as typed. */
const safe = (v: string) => v;

export function cardRow(c: Omit<Card, 'row'>): (string | number)[] {
  return [
    c.id,
    c.owner,
    c.list,
    c.pos,
    safe(c.title),
    safe(c.desc),
    c.labels.join(', '),
    c.start,
    c.due,
    c.dueDone ? 'Yes' : '',
    c.complete ? 'Yes' : '',
    c.checklists.length ? JSON.stringify(c.checklists) : '',
    c.attachments.length ? JSON.stringify(c.attachments) : '',
    c.fy,
    safe(c.waiting),
    c.top3,
    c.created,
    c.updated,
    c.archivedFrom,
    c.trelloUrl,
  ];
}

export const newId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return 'c' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 15);
};

export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function checklistProgress(c: Card) {
  const items = c.checklists.flatMap((l) => l.items);
  return { done: items.filter((i) => i[1]).length, total: items.length };
}
