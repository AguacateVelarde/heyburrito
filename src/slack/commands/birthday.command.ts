import { Injectable } from '@nestjs/common';
import { SlackCommand, SlackCommandContext } from './command.interface';
import { BirthdaysService } from '../../birthdays/birthdays.service';
import { BirthdayAnnouncerService } from '../birthday-announcer.service';
import { I18nService } from '../../i18n/i18n.service';
import { ConfigService } from '../../config/config.service';
import { formatDayMonth } from '../../birthdays/birthday-date.util';

const SUPPORTED_COMMANDS = ['/birthday', '/cumpleanos', '/cumpleaños'];

/** Spanish aliases keep the command usable for teams running in either language. */
const SUBCOMMAND_ALIASES: Record<string, string> = {
  set: 'set',
  registrar: 'set',
  mi: 'set',
  add: 'add',
  agregar: 'add',
  añadir: 'add',
  anadir: 'add',
  remove: 'remove',
  delete: 'remove',
  eliminar: 'remove',
  borrar: 'remove',
  quitar: 'remove',
  list: 'list',
  lista: 'list',
  listar: 'list',
  next: 'next',
  upcoming: 'next',
  proximos: 'next',
  próximos: 'next',
  today: 'today',
  hoy: 'today',
  announce: 'announce',
  anunciar: 'announce',
  felicitar: 'announce',
  help: 'help',
  ayuda: 'help',
};

const MENTION = /^<@([A-Z0-9]+)(?:\|[^>]*)?>$/i;
const MAX_UPCOMING = 25;

@Injectable()
export class BirthdayCommand implements SlackCommand {
  constructor(
    private readonly birthdaysService: BirthdaysService,
    private readonly announcer: BirthdayAnnouncerService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
  ) {}

  canHandle(command: string): boolean {
    return SUPPORTED_COMMANDS.includes(command);
  }

  async execute(context: SlackCommandContext): Promise<void> {
    if (!this.configService.areBirthdaysEnabled) {
      return this.reply(context, 'birthday.errors.disabled');
    }

    const tokens = (context.text ?? '').trim().split(/\s+/).filter(Boolean);
    const [rawSubcommand, ...args] = tokens;
    const subcommand = SUBCOMMAND_ALIASES[(rawSubcommand ?? '').toLowerCase()];

    try {
      switch (subcommand) {
        case 'set':
          return await this.handleSet(context, args);
        case 'add':
          return await this.handleAdd(context, args);
        case 'remove':
          return await this.handleRemove(context, args);
        case 'list':
          return await this.handleList(context);
        case 'next':
          return await this.handleNext(context, args);
        case 'today':
          return await this.handleToday(context);
        case 'announce':
          return await this.handleAnnounce(context);
        case 'help':
          return this.showHelp(context);
        default:
          if (!rawSubcommand) {
            return this.showHelp(context);
          }
          return this.showHelp(
            context,
            this.i18nService.translate('birthday.errors.unknownSubcommand', {
              subcommand: rawSubcommand,
            }),
          );
      }
    } catch (error) {
      context.response.json({
        text: error.response?.message ?? error.message,
        response_type: 'ephemeral',
      });
    }
  }

  private async handleSet(context: SlackCommandContext, args: string[]) {
    return this.save(context, context.userId, args[0]);
  }

  private async handleAdd(context: SlackCommandContext, args: string[]) {
    const mentionIndex = args.findIndex((arg) => this.toUserId(arg));
    if (mentionIndex === -1) {
      return this.reply(context, 'birthday.errors.missingUser');
    }

    const slackId = this.toUserId(args[mentionIndex]);
    const date = args.find((arg, index) => index !== mentionIndex);
    return this.save(context, slackId, date);
  }

  private async save(
    context: SlackCommandContext,
    slackId: string,
    rawDate?: string,
  ) {
    if (!rawDate) {
      return this.reply(context, 'birthday.errors.missingDate', {
        command: context.command,
      });
    }

    const { day, month, year } = this.birthdaysService.parseDate(rawDate);
    await this.birthdaysService.upsert({ slackId, day, month, year });

    return this.reply(
      context,
      year ? 'birthday.savedWithYear' : 'birthday.saved',
      {
        userId: slackId,
        date: formatDayMonth(day, month),
        year,
      },
    );
  }

  private async handleRemove(context: SlackCommandContext, args: string[]) {
    const slackId =
      args.map((arg) => this.toUserId(arg)).find(Boolean) ?? context.userId;

    const removed = await this.birthdaysService.remove(slackId);
    return this.reply(
      context,
      removed ? 'birthday.removed' : 'birthday.errors.notFound',
      { userId: slackId },
    );
  }

  private async handleList(context: SlackCommandContext) {
    const birthdays = await this.birthdaysService.findAll();
    if (birthdays.length === 0) {
      return this.reply(context, 'birthday.list.empty', {
        command: context.command,
      });
    }

    const lines = birthdays.map((birthday) =>
      this.i18nService.translate('birthday.list.entry', {
        userId: birthday.slackId,
        date: formatDayMonth(birthday.day, birthday.month),
      }),
    );

    context.response.json({
      response_type: 'in_channel',
      text: `${this.i18nService.translate('birthday.list.title')}\n${lines.join('\n')}`,
    });
  }

  private async handleNext(context: SlackCommandContext, args: string[]) {
    const requested = Number.parseInt(args[0], 10);
    const limit = Number.isNaN(requested)
      ? 5
      : Math.min(Math.max(requested, 1), MAX_UPCOMING);

    const upcoming = await this.birthdaysService.findUpcoming(limit);
    if (upcoming.length === 0) {
      return this.reply(context, 'birthday.list.empty', {
        command: context.command,
      });
    }

    const lines = upcoming.map(({ birthday, daysUntil }, index) =>
      this.i18nService.translate('birthday.upcoming.entry', {
        position: index + 1,
        userId: birthday.slackId,
        date: formatDayMonth(birthday.day, birthday.month),
        when: this.describeDelay(daysUntil),
      }),
    );

    context.response.json({
      response_type: 'in_channel',
      text: `${this.i18nService.translate('birthday.upcoming.title')}\n${lines.join('\n')}`,
    });
  }

  private async handleToday(context: SlackCommandContext) {
    const celebrants = await this.birthdaysService.findCelebrantsOn();
    if (celebrants.length === 0) {
      return this.reply(context, 'birthday.today.none');
    }

    const lines = celebrants.map((birthday) =>
      this.i18nService.translate('birthday.today.entry', {
        userId: birthday.slackId,
      }),
    );

    context.response.json({
      response_type: 'in_channel',
      text: `${this.i18nService.translate('birthday.today.title')}\n${lines.join('\n')}`,
    });
  }

  private async handleAnnounce(context: SlackCommandContext) {
    const { announced, channels } = await this.announcer.announce({
      force: true,
    });

    if (announced.length === 0) {
      return this.reply(context, 'birthday.nothingToAnnounce');
    }

    return this.reply(context, 'birthday.announced', {
      mentions: announced.map((b) => `<@${b.slackId}>`).join(', '),
      channel: channels[0],
    });
  }

  private describeDelay(daysUntil: number): string {
    if (daysUntil === 0) {
      return this.i18nService.translate('birthday.upcoming.today');
    }
    if (daysUntil === 1) {
      return this.i18nService.translate('birthday.upcoming.tomorrow');
    }
    return this.i18nService.translate('birthday.upcoming.inDays', {
      days: daysUntil,
    });
  }

  private showHelp(context: SlackCommandContext, prefix?: string) {
    const help = this.i18nService.translate('birthday.help', {
      command: context.command,
    });
    context.response.json({
      text: prefix ? `${prefix}\n\n${help}` : help,
      response_type: 'ephemeral',
    });
  }

  private reply(
    context: SlackCommandContext,
    key: string,
    params?: Record<string, string | number>,
  ) {
    context.response.json({
      text: this.i18nService.translate(key, params),
      response_type: 'ephemeral',
    });
  }

  /** Accepts `<@U123>`, `<@U123|name>` and a bare user id. */
  private toUserId(token?: string): string | undefined {
    if (!token) {
      return undefined;
    }
    const mention = MENTION.exec(token);
    if (mention) {
      return mention[1].toUpperCase();
    }
    return /^[UW][A-Z0-9]{6,}$/i.test(token) ? token.toUpperCase() : undefined;
  }
}
