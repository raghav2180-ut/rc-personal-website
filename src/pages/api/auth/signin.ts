import type { APIRoute } from 'astro';
import { callbackUrl, randomToken, safeNext, STATE_COOKIE } from '../../../lib/life/auth';
import { requireEnv } from '../../../lib/life/env';

export const prerender = false;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const state = randomToken();
  const next = safeNext(url.searchParams.get('next'));
  cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    path: '/api/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: callbackUrl(url.origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    hd: 'unsaidtalks.com',
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};
