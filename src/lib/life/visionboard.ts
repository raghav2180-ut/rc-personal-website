/**
 * Raghav's vision board and pictures, shown on the Life Vision tab (Kajol's is empty).
 *
 * The pictures are stored encrypted with the site (vision-photos.sealed.ts);
 * the key is in the private sheet (VisionPhotos!B1), so only signed-in users
 * of the platform can see them. Served by /api/life/photo/[name].
 */
import type { Person } from './env';
import { sheets } from './sheets';

const PICTURES = Array.from({ length: 11 }, (_, i) => `ai-${i + 1}`);
const KNOWN = new Set(['board', ...PICTURES]);
const url = (name: string) => `/api/life/photo/${name}.jpg`;

/** The vision board image and the pictures under it, or nothing for Kajol. */
export function visionPictures(person: Person): { board: string; pictures: string[] } | null {
  return person === 'Raghav' ? { board: url('board'), pictures: PICTURES.map(url) } : null;
}

let keyCache: { key: CryptoKey; at: number } | null = null;

async function unlockKey(): Promise<CryptoKey> {
  if (keyCache && Date.now() - keyCache.at < 30 * 60_000) return keyCache.key;
  const [grid] = await sheets().batchGet(['VisionPhotos!B1']);
  const b64 = (grid[0]?.[0] ?? '').trim();
  if (!b64) throw new Error('The vision picture key is missing from the sheet (VisionPhotos!B1).');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  keyCache = { key, at: Date.now() };
  return key;
}

/** A picture as JPEG bytes, or null for an unknown name. */
export async function photoBytes(name: string): Promise<ArrayBuffer | null> {
  if (!KNOWN.has(name)) return null;
  const { SEALED } = await import('./vision-photos.sealed');
  const sealed = SEALED[name];
  if (!sealed) return null;
  const buf = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, await unlockKey(), buf.slice(12));
}
