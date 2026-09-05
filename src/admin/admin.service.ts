import { Injectable, NotFoundException } from '@nestjs/common';
import { BurritosService } from '../burritos/burritos.service';
import { UsersService } from '../users/users.service';
import { BirthdaysService } from '../birthdays/birthdays.service';
import { BirthdayAnnouncerService } from '../slack/birthday-announcer.service';
import { UpsertBirthdayDto } from '../birthdays/dto/upsert-birthday.dto';
import {
  daysUntilBirthday,
  isCelebratedOn,
} from '../birthdays/birthday-date.util';
import { AnnounceBirthdayDto } from '../birthdays/dto/announce-birthday.dto';

const ACTIVITY_DAYS = 30;

/** All windows are UTC based so the counters and the chart agree. */
function startOfUtcDay(date = new Date()): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfUtcMonth(date = new Date()): Date {
  const copy = startOfUtcDay(date);
  copy.setUTCDate(1);
  return copy;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly burritosService: BurritosService,
    private readonly usersService: UsersService,
    private readonly birthdaysService: BirthdaysService,
    private readonly birthdayAnnouncer: BirthdayAnnouncerService,
  ) {}

  async getBurritoStats() {
    const last30Start = startOfUtcDay();
    last30Start.setUTCDate(last30Start.getUTCDate() - (ACTIVITY_DAYS - 1));

    const [total, today, thisMonth, last30Days] = await Promise.all([
      this.burritosService.countAll(),
      this.burritosService.countSince(startOfUtcDay()),
      this.burritosService.countSince(startOfUtcMonth()),
      this.burritosService.countSince(last30Start),
    ]);

    return {
      total,
      today,
      thisMonth,
      last30Days,
      dailyAverage: Math.round((last30Days / ACTIVITY_DAYS) * 10) / 10,
    };
  }

  async getUserStats() {
    const users = await this.usersService.findAll();
    const active = users.filter(
      (user) => user.burritosReceived > 0 || user.burritosGiven > 0,
    );

    return {
      total: users.length,
      active: active.length,
      topGivers: await this.usersService.getTopGivers(5),
    };
  }

  async getLeaderboard() {
    return this.burritosService.getLeaderboardStats();
  }

  async getActivity() {
    return this.burritosService.getDailyCounts(ACTIVITY_DAYS);
  }

  async getBirthdayStats() {
    const [all, today, upcoming] = await Promise.all([
      this.birthdaysService.findAll(),
      this.birthdaysService.findCelebrantsOn(),
      this.birthdaysService.findUpcoming(5),
    ]);

    return {
      total: all.length,
      today: today.map((birthday) => ({
        slackId: birthday.slackId,
        name: birthday.name,
      })),
      upcoming: upcoming.map(({ birthday, daysUntil }) => ({
        slackId: birthday.slackId,
        name: birthday.name,
        day: birthday.day,
        month: birthday.month,
        daysUntil,
      })),
    };
  }

  async getDashboard() {
    const [burritoStats, userStats, leaderboard, activity, birthdayStats] =
      await Promise.all([
        this.getBurritoStats(),
        this.getUserStats(),
        this.getLeaderboard(),
        this.getActivity(),
        this.getBirthdayStats(),
      ]);

    return {
      burritoStats,
      userStats,
      leaderboard,
      activity,
      birthdayStats,
      birthdayStatus: this.getBirthdayStatus(),
      generatedAt: new Date().toISOString(),
    };
  }

  async getTransactions({ limit = 50, skip = 0 } = {}) {
    return this.burritosService.getTransactionsPage({ limit, skip });
  }

  async getUsers() {
    return this.usersService.findAll();
  }

  async getBirthdays() {
    const birthdays = await this.birthdaysService.findAll();
    const now = new Date();

    return birthdays.map((birthday) => ({
      ...birthday.toObject(),
      daysUntil: daysUntilBirthday(birthday, now),
      isToday: isCelebratedOn(birthday, now),
      greetedThisYear: this.birthdaysService.alreadyGreeted(birthday, now),
    }));
  }

  getBirthdayStatus() {
    return this.birthdayAnnouncer.getStatus();
  }

  async getUpcomingBirthdays(limit: number) {
    const upcoming = await this.birthdaysService.findUpcoming(limit);
    return upcoming.map(({ birthday, daysUntil }) => ({
      ...birthday.toObject(),
      daysUntil,
    }));
  }

  async saveBirthday({ announceIfToday, ...dto }: UpsertBirthdayDto) {
    const birthday = await this.birthdaysService.upsert(dto);
    const celebratesToday = isCelebratedOn(birthday, new Date());

    if (!announceIfToday || !celebratesToday) {
      return {
        birthday,
        celebratesToday,
        announced: null,
        announceError: null,
      };
    }

    // The save already succeeded, so a Slack failure is reported alongside it
    // rather than rolling the whole request back.
    try {
      const result = await this.birthdayAnnouncer.announce({ force: true });
      return {
        birthday,
        celebratesToday,
        announced: result.announced.map((entry) => entry.slackId),
        announceError: null,
      };
    } catch (error) {
      return {
        birthday,
        celebratesToday,
        announced: null,
        announceError: error.response?.message ?? error.message,
      };
    }
  }

  async deleteBirthday(slackId: string) {
    const removed = await this.birthdaysService.remove(slackId);
    if (!removed) {
      throw new NotFoundException(`No birthday registered for ${slackId}`);
    }
    return { removed: true, slackId };
  }

  async announceBirthdays({ channel, force }: AnnounceBirthdayDto) {
    const result = await this.birthdayAnnouncer.announce({ channel, force });
    return {
      announced: result.announced.map((b) => b.slackId),
      skipped: result.skipped.map((b) => b.slackId),
      channels: result.channels,
    };
  }
}
