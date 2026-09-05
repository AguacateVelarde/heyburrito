import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as path from 'path';
import { AuthService } from 'src/auth/auth.service';
import { LoginDto } from 'src/auth/dto/login.dto';
import { UpsertBirthdayDto } from 'src/birthdays/dto/upsert-birthday.dto';
import { AnnounceBirthdayDto } from 'src/birthdays/dto/announce-birthday.dto';

const MAX_PAGE_SIZE = 200;

function toPositiveInt(value: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

@Controller('admin')
export class AdminController {
  private readonly uiPath = path.join(__dirname, '..', '..', 'ui');

  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get('login')
  serveLoginPage(@Res() res: Response) {
    res.sendFile(path.join(this.uiPath, 'login.html'));
  }

  @Get('ui')
  serveDashboardPage(@Res() res: Response) {
    res.sendFile(path.join(this.uiPath, 'dashboard.html'));
  }

  @Post('auth/login')
  async login(@Body() { username, password }: LoginDto) {
    // validateUser throws 401 on bad credentials; without it any username and
    // password would have been handed a valid admin token.
    const user = await this.authService.validateUser(username, password);
    return this.authService.login(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('dashboard')
  async getDashboardData() {
    return this.adminService.getDashboard();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('transactions')
  async getTransactions(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.adminService.getTransactions({
      limit: toPositiveInt(limit, 50, MAX_PAGE_SIZE),
      skip: toPositiveInt(skip, 0, Number.MAX_SAFE_INTEGER),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('birthdays')
  async getBirthdays() {
    return this.adminService.getBirthdays();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('birthdays/status')
  getBirthdayStatus() {
    return this.adminService.getBirthdayStatus();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('birthdays/upcoming')
  async getUpcomingBirthdays(@Query('limit') limit?: string) {
    return this.adminService.getUpcomingBirthdays(toPositiveInt(limit, 5, 50));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('birthdays')
  async saveBirthday(@Body() birthday: UpsertBirthdayDto) {
    return this.adminService.saveBirthday(birthday);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('birthdays/:slackId')
  async deleteBirthday(@Param('slackId') slackId: string) {
    return this.adminService.deleteBirthday(slackId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('birthdays/announce')
  async announceBirthdays(@Body() options: AnnounceBirthdayDto) {
    return this.adminService.announceBirthdays(options ?? {});
  }
}
