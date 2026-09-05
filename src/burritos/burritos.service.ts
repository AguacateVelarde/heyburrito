import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Burrito } from './schemas/burrito.schema';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../config/config.service';
import { I18nService } from 'src/i18n/i18n.service';

@Injectable()
export class BurritosService {
  constructor(
    @InjectModel(Burrito.name) private burritoModel: Model<Burrito>,
    private usersService: UsersService,
    private configService: ConfigService,
    private i18nService: I18nService,
  ) {}

  async giveBurrito({
    giverId,
    receiverId,
    message,
  }: {
    giverId: string;
    receiverId: string;
    message?: string;
  }) {
    if (giverId === receiverId) {
      throw new UnprocessableEntityException({
        message: this.i18nService.translate('burrito.giveBurrito.self'),
      });
    }

    const monthlyLimit = this.configService.monthlyBurritoLimit;
    if (monthlyLimit > 0) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const burritosGivenThisMonth = await this.burritoModel.countDocuments({
        giverId,
        createdAt: { $gte: startOfMonth },
      });

      if (burritosGivenThisMonth >= monthlyLimit) {
        throw new UnprocessableEntityException({
          message: this.i18nService.translate('burrito.giveBurrito.limit', {
            monthlyLimit,
          }),
        });
      }
    }

    const burrito = await this.burritoModel.create({
      giverId,
      receiverId,
      message,
    });

    const giver = await this.usersService.findOrCreate(giverId);
    const receiver = await this.usersService.findOrCreate(receiverId);

    await this.usersService.updateStats(giver, 'burritosGiven');
    await this.usersService.updateStats(receiver, 'burritosReceived');
    return burrito;
  }

  async getLeaderboardStats() {
    return this.usersService.getLeaderboard();
  }

  async getLeaderboard() {
    if (!this.configService.isLeaderboardEnabled) {
      throw new UnprocessableEntityException({
        message: this.i18nService.translate('burritos.getLeaderboard.disabled'),
      });
    }
    return this.usersService.getLeaderboard();
  }

  async getAllTransactions() {
    return this.burritoModel.find().sort({ createdAt: -1 }).exec();
  }

  /** Newest transactions first, with the total so the UI can paginate. */
  async getTransactionsPage({ limit = 50, skip = 0 } = {}) {
    const [items, total] = await Promise.all([
      this.burritoModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.burritoModel.countDocuments().exec(),
    ]);

    return { items, total, limit, skip };
  }

  async countAll(): Promise<number> {
    return this.burritoModel.countDocuments().exec();
  }

  async countSince(date: Date): Promise<number> {
    return this.burritoModel
      .countDocuments({ createdAt: { $gte: date } })
      .exec();
  }

  /**
   * Burritos given per day over the last `days` days (UTC), including the days
   * with no activity so the chart keeps an even x axis.
   */
  async getDailyCounts(days = 30): Promise<{ date: string; count: number }[]> {
    const start = startOfUtcDay(new Date());
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const rows = await this.burritoModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = new Map(rows.map((row) => [row._id, row.count]));

    return Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(day.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      return { date, count: counts.get(date) ?? 0 };
    });
  }
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}
