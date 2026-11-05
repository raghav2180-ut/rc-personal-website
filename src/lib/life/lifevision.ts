/**
 * Life Vision and Bucket list: short lists kept in the sheet's LifeVision tab,
 * one row per line, private to each person.
 *
 * Columns: A ID · B Owner · C List (Vision | Bucket) · D Position · E Text ·
 *          F Done (Yes) · G Done on · H Updated
 */
import { UserError } from './actions';
import { todayIST } from './dates';
import type { Person } from './env';
import { sheets, type Grid } from './sheets';

export const LV_TAB = 'LifeVision';
const RANGE = `${LV_TAB}!A2:H`;
const HEADER = ['ID', 'Owner', 'List', 'Position', 'Text', 'Done', 'Done on', 'Updated'];
export type ListName = 'Vision' | 'Bucket';
export const LISTS: ListName[] = ['Vision', 'Bucket'];

export interface Item {
  row: number;
  id: string;
  owner: Person;
  list: ListName;
  pos: number;
  text: string;
  done: boolean;
  doneOn: string;
}

function parse(grid: Grid): Item[] {
  return grid
    .map((r, i) => ({
      row: i + 2,
      id: (r[0] ?? '').trim(),
      owner: (r[1] ?? '').trim() as Person,
      list: (r[2] ?? '').trim() as ListName,
      pos: Number(r[3] ?? 0) || 0,
      text: (r[4] ?? '').trim(),
      done: /^(yes|true|✓)$/i.test((r[5] ?? '').trim()),
      doneOn: (r[6] ?? '').trim(),
    }))
    .filter((it) => it.id && it.text && LISTS.includes(it.list))
    .sort((a, b) => a.pos - b.pos || a.row - b.row);
}

async function read() {
  const s = sheets();
  await s.ensureTab(LV_TAB, HEADER);
  const [grid] = await s.batchGet([RANGE]);
  return { s, items: parse(grid), used: grid.length + 1 };
}

export async function loadLifeVision(person: Person) {
  const { items } = await read();
  const mine = items.filter((it) => it.owner === person);
  return { vision: mine.filter((it) => it.list === 'Vision'), bucket: mine.filter((it) => it.list === 'Bucket') };
}

const now = () => new Date().toISOString();
const newId = () => `lv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clean = (t: string) => t.replace(/\s+/g, ' ').trim();

async function mineById(person: Person, id: string) {
  const r = await read();
  const it = r.items.find((x) => x.id === id);
  if (!it || it.owner !== person) throw new UserError('That line moved. Refresh and try again.');
  return { ...r, it };
}

export async function addItem(person: Person, list: ListName, text: string) {
  if (!LISTS.includes(list)) throw new UserError('Unknown list.');
  const t = clean(text);
  if (!t) throw new UserError('Write something first.');
  const { s, items } = await read();
  const pos = items.filter((x) => x.owner === person && x.list === list).reduce((m, x) => Math.max(m, x.pos), 0) + 1;
  await s.append(`${LV_TAB}!A:H`, [[newId(), person, list, pos, t, '', '', now()]], { raw: true });
}

export async function editItem(person: Person, id: string, text: string) {
  const t = clean(text);
  if (!t) throw new UserError('The line can’t be empty. Use Delete to remove it.');
  const { s, it } = await mineById(person, id);
  await s.batchUpdate([{ range: `${LV_TAB}!E${it.row}`, values: [[t]] }, { range: `${LV_TAB}!H${it.row}`, values: [[now()]] }], { raw: true });
}

export async function toggleItem(person: Person, id: string) {
  const { s, it } = await mineById(person, id);
  const done = !it.done;
  await s.batchUpdate([{ range: `${LV_TAB}!F${it.row}:H${it.row}`, values: [[done ? 'Yes' : '', done ? todayIST() : '', now()]] }], { raw: true });
  return done;
}

export async function deleteItem(person: Person, id: string) {
  const { s, it } = await mineById(person, id);
  await s.batchUpdate([{ range: `${LV_TAB}!A${it.row}:H${it.row}`, values: [['', '', '', '', '', '', '', '']] }], { raw: true });
}

export async function moveItem(person: Person, id: string, dir: 'up' | 'down') {
  const { s, items, it } = await mineById(person, id);
  const list = items.filter((x) => x.owner === person && x.list === it.list);
  const i = list.findIndex((x) => x.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  // Renumber the whole list so positions stay 1..n, then swap the two.
  const order = list.map((x) => x.id);
  [order[i], order[j]] = [order[j], order[i]];
  await s.batchUpdate(
    list.map((x) => ({ range: `${LV_TAB}!D${x.row}`, values: [[order.indexOf(x.id) + 1]] })),
    { raw: true },
  );
}

/** Vision 2029 text: paragraphs in Vision!A (Raghav) or G (Kajol), plus "Today's question". */
export async function saveVision2029(person: Person, body: string, question: string) {
  const paras = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!paras.length) throw new UserError('Write at least one paragraph.');
  const q = clean(question);
  const rows = [...paras, ...(q ? [`Today's question: ${q}`] : [])];
  if (rows.length > 15) throw new UserError('Keep it to 14 paragraphs or fewer.');
  const col = person === 'Kajol' ? 'G' : 'A';
  const values = Array.from({ length: 15 }, (_, i) => [rows[i] ?? '']);
  await sheets().batchUpdate([{ range: `Vision!${col}1:${col}15`, values }], { raw: true });
}
