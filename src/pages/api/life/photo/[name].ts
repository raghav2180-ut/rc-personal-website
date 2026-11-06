import type { APIRoute } from 'astro';
import { photoBytes } from '../../../../lib/life/visionboard';

export const prerender = false;

/** A vision-board family photo, decrypted for a signed-in user (the middleware checks the session). */
export const GET: APIRoute = async ({ params }) => {
  try {
    const bytes = await photoBytes(String(params.name ?? '').replace(/\.jpg$/, ''));
    if (!bytes) return new Response('Not found', { status: 404 });
    return new Response(bytes, {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (err) {
    console.error('[life] photo failed', err);
    return new Response('Photo unavailable', { status: 500 });
  }
};
