import { Controller, Get, UseGuards, Res, Post, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as path from 'path';
import { AuthService } from 'src/auth/auth.service';

@Controller('admin')
export class AdminController {
  private readonly uiPath = path.join(__dirname, '..', '..', 'ui');

  @Get('login')
  serveLoginPage(@Res() res: Response) {
    console.log('Serving login page');
    res.sendFile(path.join(this.uiPath, 'login.html'));
  }

  @Get('ui')
  serveDashboardPage(@Res() res: Response) {
    res.sendFile(path.join(this.uiPath, 'dashboard.html'));
  }

  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Post('auth/login')
  validateUser(
    @Body() { username, password }: { username: string; password: string },
  ) {
    return this.authService.login({ username, password });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('dashboard')
  async getDashboardData() {
    const [burritoStats, userStats, leaderboard] = await Promise.all([
      this.adminService.getBurritoStats(),
      this.adminService.getUserStats(),
      this.adminService.getLeaderboard(),
    ]);

    return {
      burritoStats,
      userStats,
      leaderboard,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('transactions')
  async getTransactions() {
    return this.adminService.getTransactions();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }
}
