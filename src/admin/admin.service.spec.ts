import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { BurritosService } from '../burritos/burritos.service';
import { UsersService } from '../users/users.service';
import { BirthdaysService } from '../birthdays/birthdays.service';
import { BirthdayAnnouncerService } from '../slack/birthday-announcer.service';

const mockBurritosService = {
  countAll: jest.fn(),
  countSince: jest.fn(),
  getDailyCounts: jest.fn(),
  getTransactionsPage: jest.fn(),
  getLeaderboardStats: jest.fn(),
};

const mockUsersService = {
  findAll: jest.fn(),
  getTopGivers: jest.fn(),
};

const mockBirthdaysService = {
  findAll: jest.fn(),
  findCelebrantsOn: jest.fn(),
  findUpcoming: jest.fn(),
  remove: jest.fn(),
  upsert: jest.fn(),
  alreadyGreeted: jest.fn().mockReturnValue(false),
  today: jest.fn(() => ({ year: 2026, month: 9, day: 4 })),
};

const mockAnnouncer = {
  announce: jest.fn(),
  getStatus: jest.fn(),
};

/** Minimal stand-in for a Mongoose document. */
const doc = (fields: Record<string, unknown>) => ({
  ...fields,
  toObject: () => ({ ...fields }),
});

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: BurritosService, useValue: mockBurritosService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: BirthdaysService, useValue: mockBirthdaysService },
        { provide: BirthdayAnnouncerService, useValue: mockAnnouncer },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getBurritoStats', () => {
    beforeEach(() => {
      mockBurritosService.countAll.mockResolvedValue(500);
      mockBurritosService.countSince.mockResolvedValue(60);
    });

    it('averages over the 30 day window, not the all-time total', async () => {
      mockBurritosService.countAll.mockResolvedValue(9000);
      mockBurritosService.countSince.mockResolvedValue(60);

      const stats = await service.getBurritoStats();

      expect(stats.total).toBe(9000);
      expect(stats.dailyAverage).toBe(2);
    });

    it('rounds the average to one decimal', async () => {
      mockBurritosService.countSince.mockResolvedValue(100);

      const stats = await service.getBurritoStats();

      expect(stats.dailyAverage).toBe(3.3);
    });

    // countSince is called three times: today, this month, last 30 days.
    it('uses UTC day, month and 30 day windows', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:00:00Z'));

      await service.getBurritoStats();

      const [[dayStart], [monthStart], [windowStart]] =
        mockBurritosService.countSince.mock.calls;

      expect(dayStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
      // A plain getMonth() comparison would also match March of any other year.
      expect(monthStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
      expect(windowStart.toISOString()).toBe('2026-02-14T00:00:00.000Z');

      jest.useRealTimers();
    });
  });

  describe('getUserStats', () => {
    it('counts a user with only given burritos as active', async () => {
      mockUsersService.findAll.mockResolvedValue([
        { slackId: 'U1', burritosReceived: 0, burritosGiven: 3 },
        { slackId: 'U2', burritosReceived: 5, burritosGiven: 0 },
        { slackId: 'U3', burritosReceived: 0, burritosGiven: 0 },
      ]);
      mockUsersService.getTopGivers.mockResolvedValue([]);

      const stats = await service.getUserStats();

      expect(stats).toMatchObject({ total: 3, active: 2 });
    });
  });

  describe('getBirthdayStats', () => {
    it('exposes names so the UI does not have to print raw Slack ids', async () => {
      mockBirthdaysService.findAll.mockResolvedValue([{}, {}]);
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', name: 'Ana' },
        { slackId: 'U2' },
      ]);
      mockBirthdaysService.findUpcoming.mockResolvedValue([
        {
          birthday: { slackId: 'U1', name: 'Ana', day: 5, month: 3 },
          daysUntil: 0,
        },
      ]);

      const stats = await service.getBirthdayStats();

      expect(stats.total).toBe(2);
      expect(stats.today).toEqual([
        { slackId: 'U1', name: 'Ana' },
        { slackId: 'U2', name: undefined },
      ]);
      expect(stats.upcoming[0]).toEqual({
        slackId: 'U1',
        name: 'Ana',
        day: 5,
        month: 3,
        daysUntil: 0,
      });
    });
  });

  describe('getBirthdays', () => {
    it('adds the countdown so the UI does not redo the date maths', async () => {
      mockBirthdaysService.findAll.mockResolvedValue([
        doc({ slackId: 'U1', day: 4, month: 9 }),
        doc({ slackId: 'U2', day: 7, month: 9 }),
      ]);

      const result = await service.getBirthdays();

      expect(result[0]).toMatchObject({
        slackId: 'U1',
        daysUntil: 0,
        isToday: true,
        greetedThisYear: false,
      });
      expect(result[1]).toMatchObject({
        slackId: 'U2',
        daysUntil: 3,
        isToday: false,
      });
    });

    it('anchors the countdown to the configured timezone', async () => {
      // Server-local time would say the 5th here; the team's timezone says the 4th.
      mockBirthdaysService.today.mockReturnValueOnce({
        year: 2026,
        month: 9,
        day: 4,
      });
      mockBirthdaysService.findAll.mockResolvedValue([
        doc({ slackId: 'U1', day: 4, month: 9 }),
      ]);

      const [entry] = await service.getBirthdays();

      expect(entry).toMatchObject({ isToday: true, daysUntil: 0 });
    });
  });

  describe('saveBirthday', () => {
    it('greets right away when the saved birthday is today', async () => {
      mockBirthdaysService.upsert.mockResolvedValue({ day: 4, month: 9 });
      mockAnnouncer.announce.mockResolvedValue({
        announced: [{ slackId: 'U1' }],
        skipped: [],
        channels: ['C1'],
      });

      const result = await service.saveBirthday({
        slackId: 'U1',
        day: 4,
        month: 9,
        announceIfToday: true,
      });

      expect(mockAnnouncer.announce).toHaveBeenCalledWith({ force: true });
      expect(result).toMatchObject({
        celebratesToday: true,
        announced: ['U1'],
        announceError: null,
      });
    });

    it('does not greet when the birthday is not today', async () => {
      mockBirthdaysService.upsert.mockResolvedValue({ day: 15, month: 6 });

      const result = await service.saveBirthday({
        slackId: 'U1',
        day: 15,
        month: 6,
        announceIfToday: true,
      });

      expect(mockAnnouncer.announce).not.toHaveBeenCalled();
      expect(result).toMatchObject({ celebratesToday: false, announced: null });
    });

    it('does not greet when the caller did not ask for it', async () => {
      mockBirthdaysService.upsert.mockResolvedValue({ day: 4, month: 9 });

      const result = await service.saveBirthday({
        slackId: 'U1',
        day: 4,
        month: 9,
      });

      expect(mockAnnouncer.announce).not.toHaveBeenCalled();
      expect(result.celebratesToday).toBe(true);
    });

    it('keeps the save when the greeting fails', async () => {
      mockBirthdaysService.upsert.mockResolvedValue({ day: 4, month: 9 });
      mockAnnouncer.announce.mockRejectedValue({
        response: { message: 'no channel configured' },
      });

      const result = await service.saveBirthday({
        slackId: 'U1',
        day: 4,
        month: 9,
        announceIfToday: true,
      });

      expect(result).toMatchObject({
        celebratesToday: true,
        announced: null,
        announceError: 'no channel configured',
      });
      expect(result.birthday).toBeDefined();
    });

    it('never passes announceIfToday through to the store', async () => {
      mockBirthdaysService.upsert.mockResolvedValue({ day: 15, month: 6 });

      await service.saveBirthday({
        slackId: 'U1',
        day: 15,
        month: 6,
        announceIfToday: true,
      });

      expect(mockBirthdaysService.upsert).toHaveBeenCalledWith({
        slackId: 'U1',
        day: 15,
        month: 6,
      });
    });
  });

  describe('deleteBirthday', () => {
    it('throws 404 when nothing was removed', async () => {
      mockBirthdaysService.remove.mockResolvedValue(false);

      await expect(service.deleteBirthday('U1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('confirms the deletion', async () => {
      mockBirthdaysService.remove.mockResolvedValue(true);

      await expect(service.deleteBirthday('U1')).resolves.toEqual({
        removed: true,
        slackId: 'U1',
      });
    });
  });

  describe('announceBirthdays', () => {
    it('returns plain slack ids for the UI', async () => {
      mockAnnouncer.announce.mockResolvedValue({
        announced: [{ slackId: 'U1' }],
        skipped: [{ slackId: 'U2' }],
        channels: ['C1'],
      });

      await expect(service.announceBirthdays({ force: true })).resolves.toEqual(
        { announced: ['U1'], skipped: ['U2'], channels: ['C1'] },
      );
      expect(mockAnnouncer.announce).toHaveBeenCalledWith({
        channel: undefined,
        force: true,
      });
    });
  });
});
