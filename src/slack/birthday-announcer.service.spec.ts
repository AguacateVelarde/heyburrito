import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  BIRTHDAY_CRON_JOB,
  BirthdayAnnouncerService,
} from './birthday-announcer.service';
import { SlackService } from './slack.service';
import { BirthdaysService } from '../birthdays/birthdays.service';
import { I18nService } from '../i18n/i18n.service';
import { ConfigService } from '../config/config.service';

const mockBirthdaysService = {
  findCelebrantsOn: jest.fn(),
  markGreeted: jest.fn(),
  alreadyGreeted: jest.fn().mockReturnValue(false),
};

const mockSlackService = {
  postMessage: jest.fn(),
};

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

const mockConfigService = {
  areBirthdaysEnabled: true,
  birthdayChannel: 'C_GENERAL',
  birthdayCron: '0 9 * * *',
  birthdayTimezone: 'UTC',
};

// Jobs are started for real, so keep a handle on them and stop them after each
// test — otherwise the timers keep the jest process alive.
const scheduledJobs: Array<{ stop: () => void }> = [];

const mockSchedulerRegistry = {
  addCronJob: jest.fn((_name: string, job: any) => {
    scheduledJobs.push(job);
  }),
  deleteCronJob: jest.fn(),
};

describe('BirthdayAnnouncerService', () => {
  let service: BirthdayAnnouncerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayAnnouncerService,
        { provide: BirthdaysService, useValue: mockBirthdaysService },
        { provide: SlackService, useValue: mockSlackService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get<BirthdayAnnouncerService>(BirthdayAnnouncerService);
  });

  afterEach(() => {
    while (scheduledJobs.length > 0) {
      scheduledJobs.pop().stop();
    }
    jest.clearAllMocks();
    mockBirthdaysService.alreadyGreeted.mockReturnValue(false);
    mockConfigService.areBirthdaysEnabled = true;
    mockConfigService.birthdayChannel = 'C_GENERAL';
    mockConfigService.birthdayCron = '0 9 * * *';
  });

  describe('onModuleInit', () => {
    it('schedules the daily job', () => {
      service.onModuleInit();

      expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith(
        BIRTHDAY_CRON_JOB,
        expect.anything(),
      );
    });

    it('does not schedule anything when birthdays are disabled', () => {
      mockConfigService.areBirthdaysEnabled = false;

      service.onModuleInit();

      expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });

    it('does not schedule anything without a channel', () => {
      mockConfigService.birthdayChannel = '';

      service.onModuleInit();

      expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });

    it('survives an invalid cron expression', () => {
      mockConfigService.birthdayCron = 'not-a-cron';

      expect(() => service.onModuleInit()).not.toThrow();
      expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('announce', () => {
    it('does nothing when nobody is celebrating', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([]);

      const result = await service.announce();

      expect(mockSlackService.postMessage).not.toHaveBeenCalled();
      expect(result).toEqual({ announced: [], skipped: [], channels: [] });
    });

    it('greets a single person by mentioning them in the configured channel', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3 },
      ]);

      const result = await service.announce({
        reference: new Date(2025, 2, 5),
      });

      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.greeting.single',
        { userId: 'U1' },
      );
      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_GENERAL',
          text: 'birthday.greeting.single',
          gifQuery: 'happy-birthday',
        }),
      );
      expect(mockBirthdaysService.markGreeted).toHaveBeenCalledWith(
        'U1',
        new Date(2025, 2, 5),
      );
      expect(result.announced).toHaveLength(1);
    });

    it('includes the age when the birth year is known', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3, year: 1990 },
      ]);

      await service.announce({ reference: new Date(2025, 2, 5) });

      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.greeting.singleWithAge',
        { userId: 'U1', age: 35 },
      );
    });

    it('groups several celebrants into one message with every mention', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3 },
        { slackId: 'U2', day: 5, month: 3 },
      ]);

      await service.announce({ reference: new Date(2025, 2, 5) });

      expect(mockSlackService.postMessage).toHaveBeenCalledTimes(1);
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.greeting.multiple',
        { mentions: '<@U1>, <@U2>' },
      );
    });

    it('honours a per-user channel override', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3, channelId: 'C_TEAM' },
        { slackId: 'U2', day: 5, month: 3 },
      ]);

      const result = await service.announce({
        reference: new Date(2025, 2, 5),
      });

      expect(mockSlackService.postMessage).toHaveBeenCalledTimes(2);
      expect(result.channels).toEqual(['C_TEAM', 'C_GENERAL']);
    });

    it('skips people already greeted this year', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3, lastGreetedYear: 2025 },
      ]);
      mockBirthdaysService.alreadyGreeted.mockReturnValue(true);

      const result = await service.announce({
        reference: new Date(2025, 2, 5),
      });

      expect(mockSlackService.postMessage).not.toHaveBeenCalled();
      expect(result.skipped).toHaveLength(1);
    });

    it('greets again when forced', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3, lastGreetedYear: 2025 },
      ]);
      mockBirthdaysService.alreadyGreeted.mockReturnValue(true);

      const result = await service.announce({
        reference: new Date(2025, 2, 5),
        force: true,
      });

      expect(mockSlackService.postMessage).toHaveBeenCalledTimes(1);
      expect(result.announced).toHaveLength(1);
    });

    it('posts to the explicit channel when one is given', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3, channelId: 'C_TEAM' },
      ]);

      await service.announce({
        reference: new Date(2025, 2, 5),
        channel: 'C_OVERRIDE',
      });

      expect(mockSlackService.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C_OVERRIDE' }),
      );
    });

    it('fails loudly when there is no channel to post to', async () => {
      mockConfigService.birthdayChannel = '';
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3 },
      ]);

      await expect(
        service.announce({ reference: new Date(2025, 2, 5) }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('runDailyGreeting', () => {
    it('swallows errors so the cron job keeps running', async () => {
      mockBirthdaysService.findCelebrantsOn.mockRejectedValue(
        new Error('mongo is down'),
      );

      await expect(service.runDailyGreeting()).resolves.toBeUndefined();
    });
  });
});
