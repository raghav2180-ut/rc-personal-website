import type { APIRoute } from 'astro';
import { b64urlDecode, callbackUrl, publicOrigin, safeNext, startSession, STATE_COOKIE } from '../../../../lib/life/auth';
import { allowedEmails, requireEnv } from '../../../../lib/life/env';

export const prerender = false;

const fail = (reason: string) => `/life/login?error=${encodeURIComponent(reason)}`;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const raw = cookies.get(STATE_COOKIE)?.value;
  cookies.delete(STATE_COOKIE, { path: '/api/auth' });

  let saved: { state?: string; next?: string } = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }

  if (url.searchParams.get('error')) return redirect(fail('cancelled'), 302);
  const code = url.searchParams.get('code');
  if (!code || !saved.state || saved.state !== url.searchParams.get('state')) return redirect(fail('expired'), 302);

  // Exchange the code for tokens. The ID token comes straight from Google over TLS,
  // authenticated with our client secret, so its claims can be trusted after the checks below.
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: callbackUrl(url),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return redirect(fail('google'), 302);
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) return redirect(fail('google'), 302);

  let claims: { aud?: string; iss?: string; email?: string; email_verified?: boolean; name?: string; exp?: number };
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(tokens.id_token.split('.')[1])));
  } catch {
    return redirect(fail('google'), 302);
  }

  const issuerOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const fresh = (claims.exp ?? 0) > Date.now() / 1000;
  if (claims.aud !== requireEnv('GOOGLE_CLIENT_ID') || !issuerOk || !fresh || !claims.email_verified || !claims.email) {
    return redirect(fail('google'), 302);
  }

  const email = claims.email.toLowerCase();
  if (!allowedEmails().includes(email)) return redirect(fail('not-allowed'), 302);

  await startSession(cookies, email, claims.name ?? email, publicOrigin(url).startsWith('https:'));
  return redirect(safeNext(saved.next), 302);
};
