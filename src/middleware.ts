import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/life/auth';
import { canSeeMigraine } from './lib/life/migraine';

/**
 * Guards the private Life Tracker. Public pages pass straight through
 * (and are prerendered, so they never touch cookies).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isLifePage = path === '/life' || path.startsWith('/life/');
  const isLifeApi = path.startsWith('/api/life/');
  const isAuthApi = path.startsWith('/api/auth/');
  if (!isLifePage && !isLifeApi && !isAuthApi) return next();

  // Writes must come from this site's own pages.
  if (context.request.method === 'POST') {
    const origin = context.request.headers.get('origin');
    if (origin && new URL(origin).host !== context.url.host) return new Response('Forbidden', { status: 403 });
  }
  if (isAuthApi) return next();

  const isLogin = path === '/life/login' || path === '/life/login/';
  const session = isLogin ? null : await getSession(context.cookies);

  if (!isLogin && !session) {
    if (isLifeApi) return new Response('Not signed in', { status: 401 });
    const target = encodeURIComponent(path + context.url.search);
    return context.redirect(`/life/login?next=${target}`, 302);
  }

  // The Migraine Diary is health data: only the emails in MIGRAINE_EMAILS (by
  // default, Raghav's) can see it. Everyone else gets a plain "not found".
  const isMigraine = path.startsWith('/life/migraine') || path.startsWith('/api/life/migraine');
  if (isMigraine && !canSeeMigraine(session?.email)) {
    return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' } });
  }

  context.locals.session = session;
  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
