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
import {
  ageOnBirthday,
  CivilDate,
  isValidTimeZone,
} from '../birthdays/birthday-date.util';

export const BIRTHDAY_CRON_JOB = 'birthday-daily-greeting';
const BIRTHDAY_GIF_QUERY = 'happy-birthday';

export interface AnnounceOptions {
  /** Day to announce for. Defaults to today in the configured timezone. */
  today?: CivilDate;
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

/** Why the daily job is not running, when it is not. */
export type ScheduleProblem =
  | 'disabled'
  | 'no-channel'
  | 'invalid-cron'
  | 'invalid-timezone';

export interface BirthdayStatus {
  enabled: boolean;
  channel: string | null;
  cron: string;
  timezone: string;
  scheduled: boolean;
  nextRun: string | null;
  problem: ScheduleProblem | null;
  /** Today's date in `timezone`, so the UI can state which "today" it means. */
  today: string;
}

/**
 * Posts the daily birthday greeting to the team channel, @-mentioning whoever
 * is celebrating. Runs on a configurable cron and can also be triggered
 * manually from the slash command or the admin API.
 */
@Injectable()
export class BirthdayAnnouncerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayAnnouncerService.name);

  /** Set during bootstrap so the admin UI can explain a silent daily job. */
  private scheduleProblem: ScheduleProblem | null = null;

  constructor(
    private readonly birthdaysService: BirthdaysService,
    private readonly slackService: SlackService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (!this.configService.areBirthdaysEnabled) {
      this.scheduleProblem = 'disabled';
      this.logger.log('Birthdays are disabled, daily greeting not scheduled.');
      return;
    }

    if (!this.configService.birthdayChannel) {
      this.scheduleProblem = 'no-channel';
      this.logger.warn(
        'No BIRTHDAY_CHANNEL/SLACK_DEFAULT_CHANNEL configured, daily greeting not scheduled.',
      );
      return;
    }

    const cronTime = this.configService.birthdayCron;
    const timeZone = this.configService.birthdayTimezone;

    if (!isValidTimeZone(timeZone)) {
      this.scheduleProblem = 'invalid-timezone';
      this.logger.error(
        `BIRTHDAY_TIMEZONE "${timeZone}" is not a valid IANA timezone; daily greeting not scheduled.`,
      );
      return;
    }

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
      this.scheduleProblem = 'invalid-cron';
      this.logger.error(
        `Could not schedule the birthday greeting with "${cronTime}": ${error.message}`,
      );
    }
  }

  /** Configuration and schedule state, for the admin dashboard. */
  getStatus(): BirthdayStatus {
    const scheduled = this.scheduleProblem === null;

    let nextRun: string | null = null;
    if (scheduled) {
      try {
        const job = this.schedulerRegistry.getCronJob(BIRTHDAY_CRON_JOB);
        nextRun = job.nextDate().toJSDate().toISOString();
      } catch {
        // The job is gone (never registered, or already torn down).
      }
    }

    const today = this.birthdaysService.today();

    return {
      enabled: this.configService.areBirthdaysEnabled,
      channel: this.configService.birthdayChannel || null,
      cron: this.configService.birthdayCron,
      timezone: this.configService.birthdayTimezone,
      scheduled,
      nextRun,
      problem: this.scheduleProblem,
      today: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    };
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
    today = this.birthdaysService.today(),
    channel,
    force = false,
  }: AnnounceOptions = {}): Promise<AnnounceResult> {
    const defaultChannel = channel || this.configService.birthdayChannel;

    const celebrants = await this.birthdaysService.findCelebrantsOn(today);
    const skipped = force
      ? []
      : celebrants.filter((birthday) =>
          this.birthdaysService.alreadyGreeted(birthday, today),
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
          text: this.buildGreeting(group, today),
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
        await this.birthdaysService.markGreeted(birthday.slackId, today);
        announced.push(birthday);
      }
    }

    return { announced, skipped, channels: [...byChannel.keys()] };
  }

  private buildGreeting(celebrants: Birthday[], today: CivilDate): string {
    if (celebrants.length === 1) {
      const [birthday] = celebrants;
      const age = ageOnBirthday(birthday, today);
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
