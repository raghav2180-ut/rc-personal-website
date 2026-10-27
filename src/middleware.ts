import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/life/auth';

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

  context.locals.session = session;
  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
