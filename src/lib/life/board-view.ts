/** Display helpers for the board (dates in India time, due-date status). */
import type { Card } from './board-model';
import { todayIST } from './dates';

const TZ = 'Asia/Kolkata';

const hasTime = (v: string) => /T\d{2}:\d{2}/.test(v);

/** "13 Sep" or "13 Sep, 6:00 pm" (India time). Adds the year when it isn't this year. */
export function formatDue(value: string): string {
  if (!value) return '';
  const date = hasTime(value) ? new Date(value) : new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return value;
  const thisYear = todayIST().slice(0, 4);
  const year = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, year: 'numeric' }).format(date);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', ...(year !== thisYear ? { year: 'numeric' } : {}) }).format(date);
  if (!hasTime(value)) return day;
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(date).toLowerCase();
  return `${day}, ${time}`;
}

/** "16 Oct 2026, 3:59 pm" */
export function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(date).toLowerCase();
  return `${day}, ${time}`;
}

/** Date part (YYYY-MM-DD) and time part (HH:mm) of a due value, in India time, for form inputs. */
export function dueParts(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  if (!hasTime(value)) return { date: value.slice(0, 10), time: '' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}

export type DueState = 'done' | 'overdue' | 'soon' | 'later' | '';

export function dueState(card: Pick<Card, 'due' | 'dueDone'>, now = new Date()): DueState {
  if (!card.due) return '';
  if (card.dueDone) return 'done';
  const end = hasTime(card.due) ? new Date(card.due) : new Date(`${card.due}T23:59:59+05:30`);
  const diff = end.getTime() - now.getTime();
  if (diff < 0) return 'overdue';
  if (diff < 24 * 3600 * 1000) return 'soon';
  return 'later';
}

/** True when the due date falls in the Mon–Sun week containing today (India time). */
export function dueThisWeek(card: Pick<Card, 'due'>): boolean {
  if (!card.due) return false;
  const day = dueParts(card.due).date;
  const today = todayIST();
  const t = new Date(`${today}T00:00:00Z`);
  const wd = (t.getUTCDay() + 6) % 7;
  const start = new Date(t.getTime() - wd * 86400000).toISOString().slice(0, 10);
  const end = new Date(t.getTime() + (6 - wd) * 86400000).toISOString().slice(0, 10);
  return day >= start && day <= end;
}
