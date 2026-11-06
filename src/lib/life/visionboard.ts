/**
 * Vision boards under Life Vision, Vision 2029 and the Bucket list.
 *
 * Tiles live in the sheet's VisionBoard tab, one row per tile:
 *   A ID · B Owner · C Board (life | 2029 | bucket) · D Item (LifeVision line ID)
 *   E Position · F Caption · G Picture URL · H Family photo key · I Updated
 *
 * On the Life Vision and Bucket list boards every line gets a tile, and the
 * caption is the line itself; the row only holds its pictures. The 2029 board's
 * tiles are free-standing, with their own captions.
 *
 * Family photos are stored encrypted with the site (vision-photos.sealed.ts);
 * the key is in the private sheet (VisionPhotos!B1), so only signed-in users
 * of the platform can see them.
 */
import { UserError } from './actions';
import type { Person } from './env';
import type { Item } from './lifevision';
import { sheets, type Grid } from './sheets';

export type BoardName = 'life' | '2029' | 'bucket';
export const BOARDS: BoardName[] = ['life', '2029', 'bucket'];
const TAB = 'VisionBoard';
const RANGE = `${TAB}!A2:I`;
const HEADER = ['ID', 'Owner', 'Board', 'Item', 'Position', 'Caption', 'Picture URL', 'Family photo', 'Updated'];

export const PHOTOS: { key: string; label: string }[] = [
  { key: 'couple', label: 'You and Kajol' },
  { key: 'family', label: 'The whole family' },
  { key: 'parents', label: 'Mummy and Papa' },
  { key: 'raghav', label: 'Raghav' },
  { key: 'kajol', label: 'Kajol' },
  { key: 'papa', label: 'Papa' },
  { key: 'mummy', label: 'Mummy' },
  { key: 'papa-harshit', label: 'Papa, Harshit and Raghav' },
];
const PHOTO_KEYS = new Set(PHOTOS.map((p) => p.key));

export interface Tile {
  row: number; // 0 when the line has no tile row yet
  id: string;
  owner: Person;
  board: BoardName;
  item: string;
  pos: number;
  caption: string;
  image: string;
  photo: string;
  done?: boolean;
}

function parse(grid: Grid): Tile[] {
  return grid
    .map((r, i) => ({
      row: i + 2,
      id: (r[0] ?? '').trim(),
      owner: (r[1] ?? '').trim() as Person,
      board: (r[2] ?? '').trim() as BoardName,
      item: (r[3] ?? '').trim(),
      pos: Number(r[4] ?? 0) || 0,
      caption: (r[5] ?? '').trim(),
      image: (r[6] ?? '').trim(),
      photo: (r[7] ?? '').trim(),
    }))
    .filter((t) => t.id && BOARDS.includes(t.board))
    .sort((a, b) => a.pos - b.pos || a.row - b.row);
}

async function read() {
  const s = sheets();
  await s.ensureTab(TAB, HEADER);
  const [grid] = await s.batchGet([RANGE]);
  return { s, tiles: parse(grid) };
}

/** The 2029 board's tiles, or one tile per line for the Life Vision and Bucket list boards. */
export async function loadBoard(person: Person, board: BoardName, items: Item[] = []): Promise<Tile[]> {
  const { tiles } = await read();
  const mine = tiles.filter((t) => t.owner === person && t.board === board);
  if (board === '2029') return mine;
  const byItem = new Map(mine.map((t) => [t.item, t]));
  return items.map((it, i) => {
    const t = byItem.get(it.id);
    return { ...(t ?? { row: 0, id: '', owner: person, board, item: it.id, pos: i + 1, image: '', photo: '' }), caption: it.text, done: it.done };
  });
}

const now = () => new Date().toISOString();
const newId = () => `vb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function cleanImage(url: string): string {
  const u = url.trim();
  if (!u) return '';
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new UserError('That picture link isn’t a web address. Copy the image address and paste it again.');
  }
  if (parsed.protocol !== 'https:') throw new UserError('Use a picture link that starts with https://');
  return parsed.toString().slice(0, 1000);
}
const cleanPhoto = (k: string) => (k && PHOTO_KEYS.has(k) ? k : '');

export async function saveTile(
  person: Person,
  input: { id: string; board: BoardName; item: string; caption: string; image: string; photo: string },
) {
  if (!BOARDS.includes(input.board)) throw new UserError('Unknown board.');
  const image = cleanImage(input.image);
  const photo = cleanPhoto(input.photo);
  const caption = input.caption.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (input.board === '2029' && !caption) throw new UserError('Write a caption for this picture.');
  const { s, tiles } = await read();
  const existing = input.id
    ? tiles.find((t) => t.id === input.id)
    : input.item
      ? tiles.find((t) => t.owner === person && t.board === input.board && t.item === input.item)
      : undefined;
  if (existing && existing.owner !== person) throw new UserError('That picture isn’t yours to change.');
  if (existing) {
    await s.batchUpdate([{ range: `${TAB}!F${existing.row}:I${existing.row}`, values: [[input.board === '2029' ? caption : '', image, photo, now()]] }], { raw: true });
    return;
  }
  if (input.board !== '2029' && !input.item) throw new UserError('That line moved. Refresh and try again.');
  const pos = tiles.filter((t) => t.owner === person && t.board === input.board).reduce((m, t) => Math.max(m, t.pos), 0) + 1;
  await s.append(`${TAB}!A:I`, [[newId(), person, input.board, input.item, pos, input.board === '2029' ? caption : '', image, photo, now()]], { raw: true });
}

export async function deleteTile(person: Person, id: string) {
  const { s, tiles } = await read();
  const t = tiles.find((x) => x.id === id);
  if (!t || t.owner !== person) throw new UserError('That picture moved. Refresh and try again.');
  await s.batchUpdate([{ range: `${TAB}!A${t.row}:I${t.row}`, values: [Array(9).fill('')] }], { raw: true });
}

export async function moveTile(person: Person, id: string, dir: 'up' | 'down') {
  const { s, tiles } = await read();
  const t = tiles.find((x) => x.id === id);
  if (!t || t.owner !== person || t.board !== '2029') throw new UserError('That picture moved. Refresh and try again.');
  const list = tiles.filter((x) => x.owner === person && x.board === '2029');
  const i = list.findIndex((x) => x.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  const order = list.map((x) => x.id);
  [order[i], order[j]] = [order[j], order[i]];
  await s.batchUpdate(list.map((x) => ({ range: `${TAB}!E${x.row}`, values: [[order.indexOf(x.id) + 1]] })), { raw: true });
}

// --------------------------------------------------------- family photos ---

let keyCache: { key: CryptoKey; at: number } | null = null;

async function unlockKey(): Promise<CryptoKey> {
  if (keyCache && Date.now() - keyCache.at < 30 * 60_000) return keyCache.key;
  const [grid] = await sheets().batchGet(['VisionPhotos!B1']);
  const b64 = (grid[0]?.[0] ?? '').trim();
  if (!b64) throw new Error('The vision-board photo key is missing from the sheet (VisionPhotos!B1).');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  keyCache = { key, at: Date.now() };
  return key;
}

/** A family photo as JPEG bytes, or null for an unknown key. */
export async function photoBytes(name: string): Promise<ArrayBuffer | null> {
  if (!PHOTO_KEYS.has(name)) return null;
  const { SEALED } = await import('./vision-photos.sealed');
  const sealed = SEALED[name];
  if (!sealed) return null;
  const buf = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, await unlockKey(), buf.slice(12));
}
