import type { APIRoute } from 'astro';
import { endSession } from '../../../lib/life/auth';

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  endSession(cookies);
  return redirect('/life/login?signedout=1', 303);
};
