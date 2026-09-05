export interface BirthdayDateParts {
  day: number;
  month: number;
  year?: number;
}

/**
 * A calendar date with no time and no offset. Birthdays are civil dates: "5 de
 * marzo" is the same day everywhere, so every comparison here works on these
 * rather than on Date instances, whose day depends on the reader's timezone.
 */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Accepts DD/MM, DD/MM/YYYY (also with `-` or `.`) and the ISO form YYYY-MM-DD. */
const DAY_FIRST = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?$/;
const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar date it is *in `timeZone`* at instant `at`.
 *
 * The server clock is not the answer: a container running in UTC is already on
 * the next day while the team it greets is still on the previous one, so a
 * birthday registered for "today" would silently stop matching every evening.
 */
export function civilDateIn(
  timeZone: string,
  at: Date = new Date(),
): CivilDate {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  // en-CA formats as YYYY-MM-DD.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(at)
    .split('-')
    .map(Number);

  return { year, month, day };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(month: number, year?: number): number {
  if (month === 2 && year !== undefined) {
    return isLeapYear(year) ? 29 : 28;
  }
  return DAYS_IN_MONTH[month - 1];
}

/**
 * Parses a user supplied birthday. Returns null when the input is not a valid
 * calendar date so callers can answer with a friendly message instead of a 500.
 */
export function parseBirthdayInput(raw: string): BirthdayDateParts | null {
  const input = (raw ?? '').trim();
  if (!input) {
    return null;
  }

  let day: number;
  let month: number;
  let year: number | undefined;

  const iso = ISO.exec(input);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const dayFirst = DAY_FIRST.exec(input);
    if (!dayFirst) {
      return null;
    }
    day = Number(dayFirst[1]);
    month = Number(dayFirst[2]);
    year = dayFirst[3] ? Number(dayFirst[3]) : undefined;
  }

  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > daysInMonth(month, year)) {
    return null;
  }
  if (year !== undefined && (year < 1900 || year > new Date().getFullYear())) {
    return null;
  }

  return year === undefined ? { day, month } : { day, month, year };
}

/**
 * Day/month a birthday is celebrated on in a given calendar year.
 * Feb 29th birthdays are observed on Feb 28th during non-leap years.
 */
export function observedDate(
  day: number,
  month: number,
  year: number,
): { day: number; month: number } {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { day: 28, month: 2 };
  }
  return { day, month };
}

/** True when the birthday is celebrated on `today`. */
export function isCelebratedOn(
  birthday: { day: number; month: number },
  today: CivilDate,
): boolean {
  const observed = observedDate(birthday.day, birthday.month, today.year);
  return observed.day === today.day && observed.month === today.month;
}

/** Whole days between `today` and the next celebration (0 when it is today). */
export function daysUntilBirthday(
  birthday: { day: number; month: number },
  today: CivilDate,
): number {
  // Date.UTC is only used as a day counter here, never as an instant.
  const from = Date.UTC(today.year, today.month - 1, today.day);

  for (const year of [today.year, today.year + 1]) {
    const observed = observedDate(birthday.day, birthday.month, year);
    const next = Date.UTC(year, observed.month - 1, observed.day);
    if (next >= from) {
      return Math.round((next - from) / 86_400_000);
    }
  }

  return 0;
}

/** Age being celebrated on `today`, or null when the birth year is unknown. */
export function ageOnBirthday(
  birthday: { day: number; month: number; year?: number },
  today: CivilDate,
): number | null {
  if (!birthday.year) {
    return null;
  }
  return today.year - birthday.year;
}

export function formatDayMonth(day: number, month: number): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}
