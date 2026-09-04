import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Birthday } from './schemas/birthday.schema';
import { I18nService } from '../i18n/i18n.service';
import {
  BirthdayDateParts,
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
  ) {}

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
   * Active birthdays celebrated on `reference`. Feb 29th entries are picked up
   * on Feb 28th during non-leap years, hence the extra candidate in the query.
   */
  async findCelebrantsOn(reference: Date = new Date()): Promise<Birthday[]> {
    const day = reference.getDate();
    const month = reference.getMonth() + 1;

    const candidates: Array<{ day: number; month: number }> = [{ day, month }];
    if (month === 2 && day === 28) {
      candidates.push({ day: 29, month: 2 });
    }

    const found = await this.birthdayModel
      .find({ active: true, $or: candidates })
      .exec();

    return found.filter((birthday) => isCelebratedOn(birthday, reference));
  }

  /** Next birthdays ordered by proximity, today included. */
  async findUpcoming(
    limit = 5,
    reference: Date = new Date(),
  ): Promise<UpcomingBirthday[]> {
    const all = await this.birthdayModel.find({ active: true }).exec();

    return all
      .map((birthday) => ({
        birthday,
        daysUntil: daysUntilBirthday(birthday, reference),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, limit);
  }

  /** Records that `slackId` was greeted, so the daily job stays idempotent. */
  async markGreeted(
    slackId: string,
    reference: Date = new Date(),
  ): Promise<void> {
    await this.birthdayModel
      .updateOne(
        { slackId },
        {
          $set: {
            lastGreetedYear: reference.getFullYear(),
            lastGreetedAt: reference,
          },
        },
      )
      .exec();
  }

  /** True when the person has already been greeted in `reference`'s year. */
  alreadyGreeted(birthday: Birthday, reference: Date = new Date()): boolean {
    return birthday.lastGreetedYear === reference.getFullYear();
  }

  observedDateFor(birthday: Birthday, year: number) {
    return observedDate(birthday.day, birthday.month, year);
  }
}
