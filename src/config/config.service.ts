import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { BurritoConfigSchema } from './config.schema';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService<BurritoConfigSchema>) {}

  get monthlyBurritoLimit(): number {
    return this.configService.get('MONTHLY_BURRITO_LIMIT', 0);
  }

  get isLeaderboardEnabled(): boolean {
    return this.configService.get('ENABLE_LEADERBOARD', true);
  }

  get isMonthlyResetEnabled(): boolean {
    return this.configService.get('ENABLE_MONTHLY_RESET', false);
  }

  get showMonthlyLeader(): boolean {
    return this.configService.get('SHOW_MONTHLY_LEADER', false);
  }

  get slackDefaultChannel(): string {
    return this.configService.get('SLACK_DEFAULT_CHANNEL', '');
  }

  get defaultLanguage(): string {
    return this.configService.get('DEFAULT_LANGUAGE', 'en');
  }
}
