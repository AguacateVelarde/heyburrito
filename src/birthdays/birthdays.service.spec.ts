import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UnprocessableEntityException } from '@nestjs/common';
import { BirthdaysService } from './birthdays.service';
import { Birthday } from './schemas/birthday.schema';
import { I18nService } from '../i18n/i18n.service';
import { ConfigService } from '../config/config.service';

const mockBirthdayModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  updateOne: jest.fn(),
};

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

const mockConfigService = {
  birthdayTimezone: 'America/Mexico_City',
};

const exec = (value: unknown) => ({ exec: jest.fn().mockResolvedValue(value) });
const sortedExec = (value: unknown) => ({
  sort: jest.fn().mockReturnValue(exec(value)),
});

describe('BirthdaysService', () => {
  let service: BirthdaysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdaysService,
        { provide: getModelToken(Birthday.name), useValue: mockBirthdayModel },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BirthdaysService>(BirthdaysService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('parseDate', () => {
    it('returns the parsed parts for a valid date', () => {
      expect(service.parseDate('05/03/1990')).toEqual({
        day: 5,
        month: 3,
        year: 1990,
      });
    });

    it('throws with a friendly message for an invalid date', () => {
      expect(() => service.parseDate('32/13')).toThrow(
        UnprocessableEntityException,
      );
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.errors.invalidDate',
        { value: '32/13' },
      );
    });
  });

  describe('upsert', () => {
    it('throws when the slack id is missing', async () => {
      await expect(
        service.upsert({ slackId: '', day: 5, month: 3 }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.errors.missingUser',
      );
    });

    it('rejects a day that does not exist in the month', async () => {
      await expect(
        service.upsert({ slackId: 'U1', day: 31, month: 2 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates or updates the birthday', async () => {
      const saved = { slackId: 'U1', day: 5, month: 3 };
      mockBirthdayModel.findOneAndUpdate.mockReturnValue(exec(saved));

      const result = await service.upsert({ slackId: 'U1', day: 5, month: 3 });

      expect(mockBirthdayModel.findOneAndUpdate).toHaveBeenCalledWith(
        { slackId: 'U1' },
        {
          $set: { day: 5, month: 3, active: true },
          $setOnInsert: { slackId: 'U1' },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      expect(result).toBe(saved);
    });

    it('does not overwrite optional fields that were not provided', async () => {
      mockBirthdayModel.findOneAndUpdate.mockReturnValue(exec({}));

      await service.upsert({ slackId: 'U1', day: 5, month: 3, year: 1990 });

      const [, update] = mockBirthdayModel.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toEqual({
        day: 5,
        month: 3,
        active: true,
        year: 1990,
      });
      expect(update.$set).not.toHaveProperty('channelId');
      expect(update.$set).not.toHaveProperty('name');
    });
  });

  describe('remove', () => {
    it('returns true when a document was deleted', async () => {
      mockBirthdayModel.findOneAndDelete.mockReturnValue(
        exec({ slackId: 'U1' }),
      );
      await expect(service.remove('U1')).resolves.toBe(true);
    });

    it('returns false when nothing matched', async () => {
      mockBirthdayModel.findOneAndDelete.mockReturnValue(exec(null));
      await expect(service.remove('U1')).resolves.toBe(false);
    });
  });

  describe('findCelebrantsOn', () => {
    it('queries the exact day and keeps only real matches', async () => {
      mockBirthdayModel.find.mockReturnValue(
        exec([
          { slackId: 'U1', day: 5, month: 3 },
          { slackId: 'U2', day: 6, month: 3 },
        ]),
      );

      const result = await service.findCelebrantsOn({
        year: 2025,
        month: 3,
        day: 5,
      });

      expect(mockBirthdayModel.find).toHaveBeenCalledWith({
        active: true,
        $or: [{ day: 5, month: 3 }],
      });
      expect(result.map((b) => b.slackId)).toEqual(['U1']);
    });

    it('also looks up Feb 29th entries on Feb 28th of a non-leap year', async () => {
      mockBirthdayModel.find.mockReturnValue(
        exec([{ slackId: 'U1', day: 29, month: 2 }]),
      );

      const result = await service.findCelebrantsOn({
        year: 2025,
        month: 2,
        day: 28,
      });

      expect(mockBirthdayModel.find).toHaveBeenCalledWith({
        active: true,
        $or: [
          { day: 28, month: 2 },
          { day: 29, month: 2 },
        ],
      });
      expect(result.map((b) => b.slackId)).toEqual(['U1']);
    });

    it('drops Feb 29th entries on Feb 28th of a leap year', async () => {
      mockBirthdayModel.find.mockReturnValue(
        exec([{ slackId: 'U1', day: 29, month: 2 }]),
      );

      const result = await service.findCelebrantsOn({
        year: 2024,
        month: 2,
        day: 28,
      });

      expect(result).toEqual([]);
    });
  });

  describe('findUpcoming', () => {
    it('orders by proximity and applies the limit', async () => {
      mockBirthdayModel.find.mockReturnValue(
        exec([
          { slackId: 'FAR', day: 1, month: 6 },
          { slackId: 'TODAY', day: 5, month: 3 },
          { slackId: 'SOON', day: 10, month: 3 },
        ]),
      );

      const result = await service.findUpcoming(2, {
        year: 2025,
        month: 3,
        day: 5,
      });

      expect(result.map((r) => r.birthday.slackId)).toEqual(['TODAY', 'SOON']);
      expect(result.map((r) => r.daysUntil)).toEqual([0, 5]);
    });
  });

  describe('markGreeted / alreadyGreeted', () => {
    it('stores the greeting year', async () => {
      mockBirthdayModel.updateOne.mockReturnValue(exec({}));

      await service.markGreeted('U1', { year: 2025, month: 3, day: 5 });

      expect(mockBirthdayModel.updateOne).toHaveBeenCalledWith(
        { slackId: 'U1' },
        {
          $set: {
            lastGreetedYear: 2025,
            lastGreetedAt: expect.any(Date),
          },
        },
      );
    });

    it('detects a greeting already sent this year', () => {
      const birthday = { lastGreetedYear: 2025 } as any;
      expect(
        service.alreadyGreeted(birthday, { year: 2025, month: 3, day: 5 }),
      ).toBe(true);
      expect(
        service.alreadyGreeted(birthday, { year: 2026, month: 3, day: 5 }),
      ).toBe(false);
    });
  });

  describe('today', () => {
    // The bug this guards: a UTC container is already on the next day while the
    // team it greets is still on the previous one.
    const lateEvening = new Date('2026-09-05T02:56:00.000Z');

    it('uses the configured timezone, not the server clock', () => {
      expect(service.today(lateEvening)).toEqual({
        year: 2026,
        month: 9,
        day: 4,
      });
    });

    it('follows a timezone change', () => {
      mockConfigService.birthdayTimezone = 'UTC';

      expect(service.today(lateEvening)).toEqual({
        year: 2026,
        month: 9,
        day: 5,
      });

      mockConfigService.birthdayTimezone = 'America/Mexico_City';
    });
  });

  describe('findAll', () => {
    it('sorts by month and day', async () => {
      const sorted = sortedExec([]);
      mockBirthdayModel.find.mockReturnValue(sorted);

      await service.findAll();

      expect(sorted.sort).toHaveBeenCalledWith({ month: 1, day: 1 });
    });
  });
});
