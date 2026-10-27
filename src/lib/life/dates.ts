/** Date helpers. Every date is an ISO "YYYY-MM-DD" string in India time. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function timeIST(now = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(now)
    .toUpperCase();
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIso(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime());
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  return toDate(iso).getUTCDay();
}

/** The Monday of the Mon–Sat week. Sunday belongs to the week that just ended. */
export function weekStart(iso: string): string {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000);
}

/** ISO week number, for the "WEEK 44" label. */
export function isoWeek(iso: string): number {
  const d = toDate(iso);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function parts(iso: string) {
  const d = toDate(iso);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** "26 Oct" */
export function dayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${MONTHS[p.month]}`;
}

/** "Monday 26 Oct 2026" */
export function longDate(iso: string): string {
  const p = parts(iso);
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "Mon 26" */
export function shortDay(iso: string): string {
  const p = parts(iso);
  return `${DAYS[p.weekday].slice(0, 3)} ${p.day}`;
}

export function dayName(iso: string): string {
  return DAYS[weekday(iso)];
}

export function monthName(index: number, long = false): string {
  return (long ? MONTHS_LONG : MONTHS)[index];
}

/** "2026-10" for the month an ISO date falls in. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** "October 2026" from "2026-10" */
export function monthLabel(key: string, long = true): string {
  const [y, m] = key.split('-').map(Number);
  return `${monthName(m - 1, long)} ${y}`;
}

export function lastDayOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return toIso(new Date(Date.UTC(y, m, 0)));
}

/**
 * Turn a date cell from the sheet into ISO. Handles "2026-10-26",
 * "26/10/2026", "10/26/2026" (when unambiguous) and "26 Oct 2026".
 */
export function cellToIso(cell: string | undefined): string | null {
  const v = (cell ?? '').trim();
  if (!v) return null;
  if (isIso(v)) return v;
  // A spreadsheet serial number (days since 30 Dec 1899).
  if (/^\d{5}(\.\d+)?$/.test(v)) return addDays('1899-12-30', Math.floor(Number(v)));
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])];
    // The sheet uses Indian day/month order unless the first part can't be a day.
    let day = a,
      month = b;
    if (b > 12) [day, month] = [b, a];
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(v);
  if (m) {
    const month = MONTHS.findIndex((x) => x.toLowerCase() === m![2].toLowerCase());
    if (month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** Turn a month cell ("Oct 2026", "October 2026", "2026-10-01", "10/1/2026") into "2026-10". */
export function cellToMonthKey(cell: string | undefined): string | null {
  const v = (cell ?? '').trim();
  if (!v) return null;
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(v);
  if (m) {
    const month = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    if (month >= 0) return `${m[2]}-${String(month + 1).padStart(2, '0')}`;
  }
  const iso = cellToIso(v);
  return iso ? iso.slice(0, 7) : null;
}
