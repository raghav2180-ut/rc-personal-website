/**
 * Minimal Google sign-in for the Life Tracker.
 * - Sign-in uses Google's OAuth 2.0 authorization-code flow.
 * - The session is a cookie holding {email, name, exp}, signed with HMAC-SHA256 (AUTH_SECRET).
 * - Only emails in ALLOWED_EMAILS can get a session.
 * No database, no third-party auth library.
 */
import type { AstroCookies } from 'astro';
import { allowedEmails, requireEnv } from './env';

export const SESSION_COOKIE = 'dl_session';
export const STATE_COOKIE = 'dl_oauth_state';
const SESSION_DAYS = 30;

export interface Session {
  email: string;
  name: string;
  exp: number; // unix seconds
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(requireEnv('AUTH_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signSession(session: Session): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(session)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), b64urlDecode(sig), enc.encode(payload));
    if (!ok) return null;
    const session = JSON.parse(dec.decode(b64urlDecode(payload))) as Session;
    if (!session.email || session.exp < Date.now() / 1000) return null;
    // Re-check the allow-list so removing an email from ALLOWED_EMAILS signs that person out.
    if (!allowedEmails().includes(session.email.toLowerCase())) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(cookies: AstroCookies): Promise<Session | null> {
  return verifySession(cookies.get(SESSION_COOKIE)?.value);
}

export async function startSession(cookies: AstroCookies, email: string, name: string, secure: boolean) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600;
  cookies.set(SESSION_COOKIE, await signSession({ email, name, exp }), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function randomToken(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/**
 * The public address of the site for this request. Falls back to the main
 * domain if the server could not work out the real host.
 */
export function publicOrigin(url: URL): string {
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (local && import.meta.env.PROD) return 'https://chopraraghav.com';
  return url.origin;
}

export function callbackUrl(url: URL): string {
  return `${publicOrigin(url)}/api/auth/callback/google`;
}

/** Only allow redirects back into the tracker. */
export function safeNext(next: string | null | undefined, fallback = '/life'): string {
  if (!next || !next.startsWith('/life') || next.startsWith('//')) return fallback;
  return next;
}
