import type { APIContext, APIRoute } from 'astro';
import { UserError } from './actions';
import { safeNext } from './auth';
import { isIso } from './dates';
import { personForEmail, type Person } from './env';

/** Helpers for reading a submitted form safely. */
export class Form {
  constructor(private data: FormData, private me: Person) {}
  str(name: string, max = 4000): string {
    const v = this.data.get(name);
    return typeof v === 'string' ? v.slice(0, max) : '';
  }
  opt(name: string): string | null {
    const v = this.str(name, 200).trim();
    return v === '' ? null : v;
  }
  int(name: string): number {
    const n = Number(this.str(name, 20));
    if (!Number.isInteger(n) || n < 1) throw new UserError('Something in the form was off. Refresh and try again.');
    return n;
  }
  num(name: string): number | null {
    const raw = this.str(name, 20).trim();
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  date(name: string): string {
    const v = this.str(name, 10);
    if (!isIso(v)) throw new UserError('That date looks wrong. Refresh and try again.');
    return v;
  }
  /** Always the signed-in person. A form naming someone else is refused. */
  person(): Person {
    const v = this.str('person', 20);
    if (v && v !== this.me) throw new UserError('You can only change your own tracker.');
    return this.me;
  }
  all(name: string): string[] {
    return this.data.getAll(name).map((v) => (typeof v === 'string' ? v : ''));
  }
}

function withParam(path: string, key: string, value: string): string {
  const [base, hash] = path.split('#');
  const url = new URL(base, 'https://x');
  url.searchParams.delete('saved');
  url.searchParams.delete('error');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ''}`;
}

/**
 * Wrap a form handler: parse the form, run the write, then send the browser back
 * to the page it came from with ?saved=… or ?error=… so it works without JavaScript.
 */
export function formRoute(handler: (form: Form, ctx: APIContext) => Promise<string>): APIRoute {
  return async (ctx) => {
    const data = await ctx.request.formData();
    const next = safeNext(typeof data.get('next') === 'string' ? (data.get('next') as string) : null);
    try {
      const saved = await handler(new Form(data, personForEmail(ctx.locals.session!.email)), ctx);
      return ctx.redirect(withParam(next, 'saved', saved), 303);
    } catch (err) {
      const message = err instanceof UserError ? err.message : 'Could not reach the sheet. Try again in a minute.';
      if (!(err instanceof UserError)) console.error('[life] write failed', err);
      return ctx.redirect(withParam(next, 'error', message), 303);
    }
  };
}
