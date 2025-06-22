import { Injectable } from '@nestjs/common';
import { BurritosService } from '../burritos/burritos.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly burritosService: BurritosService,
    private readonly usersService: UsersService,
  ) {}

  async getBurritoStats() {
    const transactions = await this.burritosService.getAllTransactions();
    const totalBurritos = transactions.length;
    const today = new Date();
    const thisMonth = transactions.filter(
      (t) => t.createdAt.getMonth() === today.getMonth(),
    );

    return {
      total: totalBurritos,
      thisMonth: thisMonth.length,
      dailyAverage: Math.round(totalBurritos / 30),
    };
  }

  async getUserStats() {
    const users = await this.usersService.findAll();
    const activeUsers = users.filter((u) => u.burritosReceived > 0);

    return {
      total: users.length,
      active: activeUsers.length,
      topGivers: await this.usersService.getTopGivers(5),
    };
  }

  async getLeaderboard() {
    return this.burritosService.getLeaderboardStats();
  }

  async getTransactions() {
    return this.burritosService.getAllTransactions();
  }

  async getUsers() {
    return this.usersService.findAll();
  }
}
