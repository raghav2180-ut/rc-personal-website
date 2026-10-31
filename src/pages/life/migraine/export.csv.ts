import type { APIRoute } from 'astro';
import { todayIST } from '../../../lib/life/dates';
import { loadDiary, toCsv } from '../../../lib/life/migraine';

export const prerender = false;

/** Every logged day as a CSV, for a doctor. Guarded by the middleware like every /life page. */
export const GET: APIRoute = async () => {
  try {
    const { days, profile } = await loadDiary();
    return new Response(toCsv(days, profile), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="migraine-diary-${todayIST()}.csv"`,
      },
    });
  } catch (err) {
    console.error('[migraine] export failed', err);
    return new Response('Could not read the Migraine Diary sheet. Try again in a minute.', { status: 502 });
  }
};
