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
}
