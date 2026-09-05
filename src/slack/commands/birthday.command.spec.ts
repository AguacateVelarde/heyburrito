import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { BirthdayCommand } from './birthday.command';
import { BirthdaysService } from '../../birthdays/birthdays.service';
import { BirthdayAnnouncerService } from '../birthday-announcer.service';
import { I18nService } from '../../i18n/i18n.service';
import { ConfigService } from '../../config/config.service';
import { parseBirthdayInput } from '../../birthdays/birthday-date.util';

const mockBirthdaysService = {
  parseDate: jest.fn((raw: string) => {
    const parsed = parseBirthdayInput(raw);
    if (!parsed) {
      throw new UnprocessableEntityException({
        message: 'birthday.errors.invalidDate',
      });
    }
    return parsed;
  }),
  upsert: jest.fn(),
  remove: jest.fn(),
  findAll: jest.fn(),
  findUpcoming: jest.fn(),
  findCelebrantsOn: jest.fn(),
};

const mockAnnouncer = {
  announce: jest.fn(),
};

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

const mockConfigService = {
  areBirthdaysEnabled: true,
};

function makeContext(text: string) {
  const response: any = { json: jest.fn() };
  return {
    userId: 'UME',
    text,
    command: '/cumpleanos',
    channelId: 'C_HERE',
    response,
  };
}

const lastReply = (context: any) => context.response.json.mock.calls[0][0];

describe('BirthdayCommand', () => {
  let command: BirthdayCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayCommand,
        { provide: BirthdaysService, useValue: mockBirthdaysService },
        { provide: BirthdayAnnouncerService, useValue: mockAnnouncer },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    command = module.get<BirthdayCommand>(BirthdayCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConfigService.areBirthdaysEnabled = true;
  });

  describe('canHandle', () => {
    it.each(['/birthday', '/cumpleanos', '/cumpleaños'])(
      'handles %s',
      (slashCommand) => {
        expect(command.canHandle(slashCommand)).toBe(true);
      },
    );

    it('ignores other commands', () => {
      expect(command.canHandle('/burrito')).toBe(false);
    });
  });

  it('reports that the module is disabled', async () => {
    mockConfigService.areBirthdaysEnabled = false;
    const context = makeContext('list');

    await command.execute(context);

    expect(lastReply(context).text).toBe('birthday.errors.disabled');
    expect(mockBirthdaysService.findAll).not.toHaveBeenCalled();
  });

  it('shows the help text with no arguments', async () => {
    const context = makeContext('');

    await command.execute(context);

    expect(mockI18nService.translate).toHaveBeenCalledWith('birthday.help', {
      command: '/cumpleanos',
    });
  });

  it('shows the help text for an unknown subcommand', async () => {
    const context = makeContext('explota');

    await command.execute(context);

    expect(mockI18nService.translate).toHaveBeenCalledWith(
      'birthday.errors.unknownSubcommand',
      { subcommand: 'explota' },
    );
  });

  describe('set', () => {
    it('registers the caller own birthday', async () => {
      const context = makeContext('set 05/03');

      await command.execute(context);

      expect(mockBirthdaysService.upsert).toHaveBeenCalledWith({
        slackId: 'UME',
        day: 5,
        month: 3,
        year: undefined,
      });
      expect(lastReply(context).text).toBe('birthday.saved');
    });

    it('keeps the year when provided', async () => {
      const context = makeContext('set 05/03/1990');

      await command.execute(context);

      expect(mockBirthdaysService.upsert).toHaveBeenCalledWith({
        slackId: 'UME',
        day: 5,
        month: 3,
        year: 1990,
      });
      expect(lastReply(context).text).toBe('birthday.savedWithYear');
    });

    it('accepts the Spanish alias', async () => {
      const context = makeContext('registrar 05/03');

      await command.execute(context);

      expect(mockBirthdaysService.upsert).toHaveBeenCalled();
    });

    it('asks for the date when it is missing', async () => {
      const context = makeContext('set');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.errors.missingDate');
      expect(mockBirthdaysService.upsert).not.toHaveBeenCalled();
    });

    it('reports an invalid date instead of crashing', async () => {
      const context = makeContext('set 45/13');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.errors.invalidDate');
      expect(mockBirthdaysService.upsert).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('registers a mentioned teammate', async () => {
      const context = makeContext('add <@U123ABC> 05/03');

      await command.execute(context);

      expect(mockBirthdaysService.upsert).toHaveBeenCalledWith({
        slackId: 'U123ABC',
        day: 5,
        month: 3,
        year: undefined,
      });
    });

    it('understands the <@ID|name> mention form', async () => {
      const context = makeContext('add <@U123ABC|leo> 05/03');

      await command.execute(context);

      expect(mockBirthdaysService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ slackId: 'U123ABC' }),
      );
    });

    it('accepts the date before the mention', async () => {
      const context = makeContext('add 05/03 <@U123ABC>');

      await command.execute(context);

      expect(mockBirthdaysService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ slackId: 'U123ABC', day: 5, month: 3 }),
      );
    });

    it('asks for a mention when none is given', async () => {
      const context = makeContext('add 05/03');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.errors.missingUser');
      expect(mockBirthdaysService.upsert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes the mentioned teammate', async () => {
      mockBirthdaysService.remove.mockResolvedValue(true);
      const context = makeContext('remove <@U123ABC>');

      await command.execute(context);

      expect(mockBirthdaysService.remove).toHaveBeenCalledWith('U123ABC');
      expect(lastReply(context).text).toBe('birthday.removed');
    });

    it('defaults to the caller', async () => {
      mockBirthdaysService.remove.mockResolvedValue(true);
      const context = makeContext('eliminar');

      await command.execute(context);

      expect(mockBirthdaysService.remove).toHaveBeenCalledWith('UME');
    });

    it('reports when there was nothing to remove', async () => {
      mockBirthdaysService.remove.mockResolvedValue(false);
      const context = makeContext('remove');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.errors.notFound');
    });
  });

  describe('list', () => {
    it('renders every birthday in channel', async () => {
      mockBirthdaysService.findAll.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3 },
      ]);
      const context = makeContext('list');

      await command.execute(context);

      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.list.entry',
        { userId: 'U1', date: '05/03' },
      );
      expect(lastReply(context).response_type).toBe('in_channel');
    });

    it('shows the empty state', async () => {
      mockBirthdaysService.findAll.mockResolvedValue([]);
      const context = makeContext('list');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.list.empty');
    });
  });

  describe('next', () => {
    it('defaults to five entries', async () => {
      mockBirthdaysService.findUpcoming.mockResolvedValue([]);
      const context = makeContext('next');

      await command.execute(context);

      expect(mockBirthdaysService.findUpcoming).toHaveBeenCalledWith(5);
    });

    it('clamps the requested amount', async () => {
      mockBirthdaysService.findUpcoming.mockResolvedValue([]);
      const context = makeContext('next 500');

      await command.execute(context);

      expect(mockBirthdaysService.findUpcoming).toHaveBeenCalledWith(25);
    });

    it('describes today, tomorrow and further away', async () => {
      mockBirthdaysService.findUpcoming.mockResolvedValue([
        { birthday: { slackId: 'U1', day: 5, month: 3 }, daysUntil: 0 },
        { birthday: { slackId: 'U2', day: 6, month: 3 }, daysUntil: 1 },
        { birthday: { slackId: 'U3', day: 9, month: 3 }, daysUntil: 4 },
      ]);
      const context = makeContext('proximos');

      await command.execute(context);

      const keys = mockI18nService.translate.mock.calls.map(([key]) => key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'birthday.upcoming.today',
          'birthday.upcoming.tomorrow',
          'birthday.upcoming.inDays',
        ]),
      );
    });
  });

  describe('today', () => {
    it('lists who is celebrating', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([
        { slackId: 'U1', day: 5, month: 3 },
      ]);
      const context = makeContext('hoy');

      await command.execute(context);

      expect(lastReply(context).response_type).toBe('in_channel');
    });

    it('reports when nobody is celebrating', async () => {
      mockBirthdaysService.findCelebrantsOn.mockResolvedValue([]);
      const context = makeContext('today');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.today.none');
    });
  });

  describe('announce', () => {
    it('forces the greeting and confirms it', async () => {
      mockAnnouncer.announce.mockResolvedValue({
        announced: [{ slackId: 'U1' }],
        skipped: [],
        channels: ['C_GENERAL'],
      });
      const context = makeContext('announce');

      await command.execute(context);

      expect(mockAnnouncer.announce).toHaveBeenCalledWith({ force: true });
      expect(mockI18nService.translate).toHaveBeenCalledWith(
        'birthday.announced',
        { mentions: '<@U1>', channel: 'C_GENERAL' },
      );
    });

    it('reports when there is nobody to greet', async () => {
      mockAnnouncer.announce.mockResolvedValue({
        announced: [],
        skipped: [],
        channels: [],
      });
      const context = makeContext('felicitar');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.nothingToAnnounce');
    });

    it('surfaces a missing channel as a friendly message', async () => {
      mockAnnouncer.announce.mockRejectedValue(
        new UnprocessableEntityException({
          message: 'birthday.errors.noChannel',
        }),
      );
      const context = makeContext('announce');

      await command.execute(context);

      expect(lastReply(context).text).toBe('birthday.errors.noChannel');
    });
  });
});
