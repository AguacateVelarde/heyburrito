import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Birthday } from './schemas/birthday.schema';
import { I18nService } from '../i18n/i18n.service';
import { ConfigService } from '../config/config.service';
import {
  BirthdayDateParts,
  CivilDate,
  civilDateIn,
  daysInMonth,
  daysUntilBirthday,
  isCelebratedOn,
  observedDate,
  parseBirthdayInput,
} from './birthday-date.util';

export interface UpsertBirthdayInput {
  slackId: string;
  day: number;
  month: number;
  year?: number;
  name?: string;
  channelId?: string;
}

export interface UpcomingBirthday {
  birthday: Birthday;
  daysUntil: number;
}

@Injectable()
export class BirthdaysService {
  constructor(
    @InjectModel(Birthday.name) private birthdayModel: Model<Birthday>,
    private i18nService: I18nService,
    private configService: ConfigService,
  ) {}

  /**
   * Today's calendar date in the configured timezone. Everything here is
   * anchored to this rather than to the server clock, which on a UTC container
   * rolls over hours before the team it greets does.
   */
  today(at: Date = new Date()): CivilDate {
    return civilDateIn(this.configService.birthdayTimezone, at);
  }

  /** Parses a raw `DD/MM[/YYYY]` string, rejecting anything that is not a real date. */
  parseDate(raw: string): BirthdayDateParts {
    const parsed = parseBirthdayInput(raw);
    if (!parsed) {
      throw new UnprocessableEntityException({
        message: this.i18nService.translate('birthday.errors.invalidDate', {
          value: (raw ?? '').trim(),
        }),
      });
    }
    return parsed;
  }

  async upsert({
    slackId,
    day,
    month,
    year,
    name,
    channelId,
  }: UpsertBirthdayInput): Promise<Birthday> {
    if (!slackId) {
      throw new UnprocessableEntityException({
        message: this.i18nService.translate('birthday.errors.missingUser'),
      });
    }

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, year)) {
      throw new UnprocessableEntityException({
        message: this.i18nService.translate('birthday.errors.invalidDate', {
          value: `${day}/${month}`,
        }),
      });
    }

    const update: Record<string, unknown> = { day, month, active: true };
    // Only overwrite optional fields when a new value is provided, so that
    // `add @user 05/03` does not wipe a previously stored year or channel.
    if (year !== undefined) update.year = year;
    if (name !== undefined) update.name = name;
    if (channelId !== undefined) update.channelId = channelId;

    return this.birthdayModel
      .findOneAndUpdate(
        { slackId },
        { $set: update, $setOnInsert: { slackId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async remove(slackId: string): Promise<boolean> {
    const removed = await this.birthdayModel
      .findOneAndDelete({ slackId })
      .exec();
    return Boolean(removed);
  }

  async findAll(): Promise<Birthday[]> {
    return this.birthdayModel.find().sort({ month: 1, day: 1 }).exec();
  }

  async findBySlackId(slackId: string): Promise<Birthday | null> {
    return this.birthdayModel.findOne({ slackId }).exec();
  }

  /**
   * Active birthdays celebrated on `today`. Feb 29th entries are picked up on
   * Feb 28th during non-leap years, hence the extra candidate in the query.
   */
  async findCelebrantsOn(today: CivilDate = this.today()): Promise<Birthday[]> {
    const { day, month } = today;

    const candidates: Array<{ day: number; month: number }> = [{ day, month }];
    if (month === 2 && day === 28) {
      candidates.push({ day: 29, month: 2 });
    }

    const found = await this.birthdayModel
      .find({ active: true, $or: candidates })
      .exec();

    return found.filter((birthday) => isCelebratedOn(birthday, today));
  }

  /** Next birthdays ordered by proximity, today included. */
  async findUpcoming(
    limit = 5,
    today: CivilDate = this.today(),
  ): Promise<UpcomingBirthday[]> {
    const all = await this.birthdayModel.find({ active: true }).exec();

    return all
      .map((birthday) => ({
        birthday,
        daysUntil: daysUntilBirthday(birthday, today),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, limit);
  }

  /** Records that `slackId` was greeted, so the daily job stays idempotent. */
  async markGreeted(
    slackId: string,
    today: CivilDate = this.today(),
  ): Promise<void> {
    await this.birthdayModel
      .updateOne(
        { slackId },
        {
          $set: { lastGreetedYear: today.year, lastGreetedAt: new Date() },
        },
      )
      .exec();
  }

  /** True when the person has already been greeted in `today`'s year. */
  alreadyGreeted(birthday: Birthday, today: CivilDate = this.today()): boolean {
    return birthday.lastGreetedYear === today.year;
  }

  observedDateFor(birthday: Birthday, year: number) {
    return observedDate(birthday.day, birthday.month, year);
  }
}
