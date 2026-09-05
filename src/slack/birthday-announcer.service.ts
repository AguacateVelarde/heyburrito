import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SlackService } from './slack.service';
import { BirthdaysService } from '../birthdays/birthdays.service';
import { Birthday } from '../birthdays/schemas/birthday.schema';
import { I18nService } from '../i18n/i18n.service';
import { ConfigService } from '../config/config.service';
import { ageOnBirthday } from '../birthdays/birthday-date.util';

export const BIRTHDAY_CRON_JOB = 'birthday-daily-greeting';
const BIRTHDAY_GIF_QUERY = 'happy-birthday';

export interface AnnounceOptions {
  /** Day to announce for. Defaults to today. */
  reference?: Date;
  /** Overrides both the per-user channel and the configured default channel. */
  channel?: string;
  /** Greets again even if the person was already greeted this year. */
  force?: boolean;
}

export interface AnnounceResult {
  announced: Birthday[];
  skipped: Birthday[];
  channels: string[];
}

/**
 * Posts the daily birthday greeting to the team channel, @-mentioning whoever
 * is celebrating. Runs on a configurable cron and can also be triggered
 * manually from the slash command or the admin API.
 */
@Injectable()
export class BirthdayAnnouncerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayAnnouncerService.name);

  constructor(
    private readonly birthdaysService: BirthdaysService,
    private readonly slackService: SlackService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (!this.configService.areBirthdaysEnabled) {
      this.logger.log('Birthdays are disabled, daily greeting not scheduled.');
      return;
    }

    if (!this.configService.birthdayChannel) {
      this.logger.warn(
        'No BIRTHDAY_CHANNEL/SLACK_DEFAULT_CHANNEL configured, daily greeting not scheduled.',
      );
      return;
    }

    const cronTime = this.configService.birthdayCron;
    const timeZone = this.configService.birthdayTimezone;

    try {
      const job = new CronJob(
        cronTime,
        () => this.runDailyGreeting(),
        null,
        false,
        timeZone,
      );
      this.schedulerRegistry.addCronJob(BIRTHDAY_CRON_JOB, job as any);
      job.start();
      this.logger.log(
        `Daily birthday greeting scheduled ("${cronTime}", ${timeZone}).`,
      );
    } catch (error) {
      this.logger.error(
        `Could not schedule the birthday greeting with "${cronTime}": ${error.message}`,
      );
    }
  }

  onModuleDestroy() {
    try {
      this.schedulerRegistry.deleteCronJob(BIRTHDAY_CRON_JOB);
    } catch {
      // The job was never scheduled (disabled or misconfigured); nothing to do.
    }
  }

  /** Cron entry point. Never throws so a Slack/Mongo hiccup cannot kill the job. */
  async runDailyGreeting(): Promise<void> {
    try {
      const result = await this.announce();
      if (result.announced.length > 0) {
        this.logger.log(
          `Birthday greeting posted for ${result.announced.length} user(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send the birthday greeting: ${error.message}`,
      );
    }
  }

  async announce({
    reference = new Date(),
    channel,
    force = false,
  }: AnnounceOptions = {}): Promise<AnnounceResult> {
    const defaultChannel = channel || this.configService.birthdayChannel;

    const celebrants = await this.birthdaysService.findCelebrantsOn(reference);
    const skipped = force
      ? []
      : celebrants.filter((birthday) =>
          this.birthdaysService.alreadyGreeted(birthday, reference),
        );
    const pending = celebrants.filter(
      (birthday) => !skipped.includes(birthday),
    );

    if (pending.length === 0) {
      return { announced: [], skipped, channels: [] };
    }

    // A user can pin their greeting to a specific channel; everyone else lands
    // in the configured team channel.
    const byChannel = new Map<string, Birthday[]>();
    for (const birthday of pending) {
      const target = channel || birthday.channelId || defaultChannel;
      if (!target) {
        throw new UnprocessableEntityException({
          message: this.i18nService.translate('birthday.errors.noChannel'),
        });
      }
      byChannel.set(target, [...(byChannel.get(target) ?? []), birthday]);
    }

    const announced: Birthday[] = [];
    for (const [target, group] of byChannel) {
      try {
        await this.slackService.postMessage({
          channel: target,
          text: this.buildGreeting(group, reference),
          gifQuery: BIRTHDAY_GIF_QUERY,
          imageTitle: this.i18nService.translate(
            'birthday.greeting.imageTitle',
          ),
        });
      } catch (error) {
        // A Slack rejection (unknown channel, bot not invited, bad token) is a
        // configuration problem, not a server fault: surface it as such so the
        // admin UI and the slash command can show something actionable.
        throw new UnprocessableEntityException({
          message: this.i18nService.translate('birthday.errors.postFailed', {
            channel: target,
            reason: error.message ?? 'error desconocido',
          }),
        });
      }

      for (const birthday of group) {
        await this.birthdaysService.markGreeted(birthday.slackId, reference);
        announced.push(birthday);
      }
    }

    return { announced, skipped, channels: [...byChannel.keys()] };
  }

  private buildGreeting(celebrants: Birthday[], reference: Date): string {
    if (celebrants.length === 1) {
      const [birthday] = celebrants;
      const age = ageOnBirthday(birthday, reference);
      return age
        ? this.i18nService.translate('birthday.greeting.singleWithAge', {
            userId: birthday.slackId,
            age,
          })
        : this.i18nService.translate('birthday.greeting.single', {
            userId: birthday.slackId,
          });
    }

    return this.i18nService.translate('birthday.greeting.multiple', {
      mentions: celebrants.map((b) => `<@${b.slackId}>`).join(', '),
    });
  }
}
