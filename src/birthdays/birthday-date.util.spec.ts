import {
  ageOnBirthday,
  daysInMonth,
  daysUntilBirthday,
  formatDayMonth,
  isCelebratedOn,
  isLeapYear,
  observedDate,
  parseBirthdayInput,
} from './birthday-date.util';

describe('birthday-date.util', () => {
  describe('parseBirthdayInput', () => {
    it.each([
      ['05/03', { day: 5, month: 3 }],
      ['5-3', { day: 5, month: 3 }],
      ['05.03', { day: 5, month: 3 }],
      ['05/03/1990', { day: 5, month: 3, year: 1990 }],
      ['1990-03-05', { day: 5, month: 3, year: 1990 }],
      ['29/02', { day: 29, month: 2 }],
    ])('parses %s', (input, expected) => {
      expect(parseBirthdayInput(input)).toEqual(expected);
    });

    it.each([
      '',
      'tomorrow',
      '32/01',
      '00/01',
      '05/13',
      '05/00',
      '30/02',
      '29/02/1990', // 1990 was not a leap year
      '05/03/1800',
    ])('rejects %s', (input) => {
      expect(parseBirthdayInput(input)).toBeNull();
    });

    it('rejects a year in the future', () => {
      const nextYear = new Date().getFullYear() + 1;
      expect(parseBirthdayInput(`05/03/${nextYear}`)).toBeNull();
    });

    it('trims surrounding whitespace', () => {
      expect(parseBirthdayInput('  05/03  ')).toEqual({ day: 5, month: 3 });
    });
  });

  describe('isLeapYear / daysInMonth', () => {
    it.each([
      [2024, true],
      [2023, false],
      [2000, true],
      [1900, false],
    ])('resolves %s', (year, expected) => {
      expect(isLeapYear(year)).toBe(expected);
    });

    it('allows Feb 29th when no year is given', () => {
      expect(daysInMonth(2)).toBe(29);
      expect(daysInMonth(2, 2024)).toBe(29);
      expect(daysInMonth(2, 2023)).toBe(28);
    });
  });

  describe('observedDate', () => {
    it('keeps Feb 29th on leap years', () => {
      expect(observedDate(29, 2, 2024)).toEqual({ day: 29, month: 2 });
    });

    it('moves Feb 29th to Feb 28th on non-leap years', () => {
      expect(observedDate(29, 2, 2025)).toEqual({ day: 28, month: 2 });
    });

    it('leaves every other date untouched', () => {
      expect(observedDate(5, 3, 2025)).toEqual({ day: 5, month: 3 });
    });
  });

  describe('isCelebratedOn', () => {
    it('matches the exact day', () => {
      expect(isCelebratedOn({ day: 5, month: 3 }, new Date(2025, 2, 5))).toBe(
        true,
      );
    });

    it('celebrates a Feb 29th birthday on Feb 28th of a non-leap year', () => {
      expect(isCelebratedOn({ day: 29, month: 2 }, new Date(2025, 1, 28))).toBe(
        true,
      );
    });

    it('does not celebrate a Feb 29th birthday on Feb 28th of a leap year', () => {
      expect(isCelebratedOn({ day: 29, month: 2 }, new Date(2024, 1, 28))).toBe(
        false,
      );
    });
  });

  describe('daysUntilBirthday', () => {
    it('returns 0 on the birthday itself', () => {
      expect(
        daysUntilBirthday({ day: 5, month: 3 }, new Date(2025, 2, 5)),
      ).toBe(0);
    });

    it('counts the days left within the same year', () => {
      expect(
        daysUntilBirthday({ day: 15, month: 3 }, new Date(2025, 2, 5)),
      ).toBe(10);
    });

    it('rolls over to next year once the date has passed', () => {
      expect(
        daysUntilBirthday({ day: 1, month: 1 }, new Date(2025, 11, 25)),
      ).toBe(7);
    });

    it('uses the observed date for Feb 29th birthdays', () => {
      expect(
        daysUntilBirthday({ day: 29, month: 2 }, new Date(2025, 1, 26)),
      ).toBe(2);
    });
  });

  describe('ageOnBirthday', () => {
    it('returns null without a birth year', () => {
      expect(ageOnBirthday({ day: 5, month: 3 })).toBeNull();
    });

    it('returns the age being celebrated', () => {
      expect(
        ageOnBirthday({ day: 5, month: 3, year: 1990 }, new Date(2025, 2, 5)),
      ).toBe(35);
    });
  });

  describe('formatDayMonth', () => {
    it('pads single digits', () => {
      expect(formatDayMonth(5, 3)).toBe('05/03');
    });
  });
});
