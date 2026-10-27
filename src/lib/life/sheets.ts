/**
 * Tiny Google Sheets client for the Dream Life tracker.
 *
 * Auth: a Google Cloud service account (GOOGLE_SERVICE_ACCOUNT_JSON) that has
 * Editor access to the sheet (SHEET_ID). We sign a JWT with Web Crypto and swap
 * it for an access token, so there is no googleapis dependency.
 *
 * Local development: set LIFE_MOCK_FILE to a JSON file shaped like
 * {"Top3": [["Date", ...], ...], ...}. Reads and writes then go to memory
 * instead of Google. This only works under `astro dev`.
 */
import { b64url } from './auth';
import { env, requireEnv } from './env';

export type Grid = string[][];

export interface SheetsClient {
  batchGet(ranges: string[]): Promise<Grid[]>;
  /** Write several ranges at once. */
  batchUpdate(data: { range: string; values: (string | number)[][] }[]): Promise<void>;
  /** Append rows below the last row of a table. */
  append(range: string, values: (string | number)[][]): Promise<void>;
}

// ---------------------------------------------------------------- Google ---

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
let cachedToken: { token: string; exp: number } | null = null;

/**
 * Read GOOGLE_SERVICE_ACCOUNT_JSON, accepting the usual ways it gets pasted
 * (raw JSON, JSON wrapped in quotes, or base64), and say exactly what's wrong
 * if it isn't a service-account key.
 */
function serviceAccount(): { client_email: string; private_key: string } {
  const raw = requireEnv('GOOGLE_SERVICE_ACCOUNT_JSON').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed); // pasted with extra quotes
  } catch {
    try {
      parsed = JSON.parse(atob(raw)); // pasted as base64
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file, from { to }.');
    }
  }
  const sa = (parsed ?? {}) as Record<string, unknown>;
  if ('web' in sa || 'installed' in sa) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON holds the OAuth client file. Use the service account key instead: IAM & Admin → Service accounts → life-tracker → Keys → Add key → JSON.',
    );
  }
  if (typeof sa.private_key !== 'string' || typeof sa.client_email !== 'string') {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON has no private_key or client_email. Paste the service account key file (it has "type": "service_account").',
    );
  }
  return { client_email: sa.client_email, private_key: sa.private_key };
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n') // keys pasted with literal \n
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = serviceAccount();
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status}). Check GOOGLE_SERVICE_ACCOUNT_JSON.`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

async function call(path: string, init: RequestInit = {}): Promise<any> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${requireEnv('SHEET_ID')}`;
  const res = await fetch(base + path, {
    ...init,
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) throw new Error('The service account cannot open the sheet. Share the sheet with its email as Editor.');
    throw new Error(`Google Sheets error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

const google: SheetsClient = {
  async batchGet(ranges) {
    const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    // Unformatted values with dates as serial numbers, so a date reads the same
    // whatever display format or locale a cell happens to have.
    const json = await call(`/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
    return (json.valueRanges ?? []).map((vr: { values?: unknown[][] }) =>
      (vr.values ?? []).map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))),
    );
  },
  async batchUpdate(data) {
    if (!data.length) return;
    await call('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    });
  },
  async append(range, values) {
    if (!values.length) return;
    await call(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    });
  },
};

// ------------------------------------------------------------------ Mock ---

interface A1 {
  tab: string;
  c0: number;
  r0: number;
  c1: number | null;
  r1: number | null;
}

function colNum(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseA1(range: string): A1 {
  const bang = range.lastIndexOf('!');
  const tab = range.slice(0, bang).replace(/^'|'$/g, '');
  const [start, end] = range.slice(bang + 1).split(':');
  const m1 = /^([A-Z]+)(\d*)$/i.exec(start)!;
  const m2 = end ? /^([A-Z]+)(\d*)$/i.exec(end)! : m1;
  return {
    tab,
    c0: colNum(m1[1]),
    r0: m1[2] ? Number(m1[2]) - 1 : 0,
    c1: colNum(m2[1]),
    r1: m2[2] ? Number(m2[2]) - 1 : end ? null : m1[2] ? Number(m1[2]) - 1 : null,
  };
}

let mockData: Record<string, Grid> | null = null;

async function mockSheets(): Promise<Record<string, Grid>> {
  if (mockData) return mockData;
  const { readFile } = await import('node:fs/promises');
  mockData = JSON.parse(await readFile(env('LIFE_MOCK_FILE')!, 'utf8'));
  return mockData!;
}

function trimRow(row: string[]): string[] {
  const out = [...row];
  while (out.length && (out[out.length - 1] ?? '') === '') out.pop();
  return out;
}

const mock: SheetsClient = {
  async batchGet(ranges) {
    const data = await mockSheets();
    return ranges.map((range) => {
      const a = parseA1(range);
      const grid = data[a.tab] ?? [];
      const rEnd = a.r1 ?? grid.length - 1;
      const out: Grid = [];
      for (let r = a.r0; r <= rEnd && r < grid.length; r++) out.push(trimRow((grid[r] ?? []).slice(a.c0, (a.c1 ?? 99) + 1)));
      while (out.length && out[out.length - 1].length === 0) out.pop();
      return out;
    });
  },
  async batchUpdate(updates) {
    const data = await mockSheets();
    for (const { range, values } of updates) {
      const a = parseA1(range);
      const grid = (data[a.tab] ??= []);
      values.forEach((row, i) => {
        const r = (grid[a.r0 + i] ??= []);
        row.forEach((v, j) => {
          while (r.length < a.c0 + j) r.push('');
          r[a.c0 + j] = String(v);
        });
      });
    }
  },
  async append(range, values) {
    const data = await mockSheets();
    const a = parseA1(range);
    const grid = (data[a.tab] ??= []);
    for (const row of values) grid.push([...Array(a.c0).fill(''), ...row.map(String)]);
  },
};

export function sheets(): SheetsClient {
  if (import.meta.env.DEV && env('LIFE_MOCK_FILE')) return mock;
  return google;
}
