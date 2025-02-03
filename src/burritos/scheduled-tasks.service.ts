import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BurritosService } from './burritos.service';
import { SlackService } from '../slack/slack.service';
import { I18nService } from '../i18n/i18n.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class ScheduledTasksService {
  constructor(
    private readonly burritosService: BurritosService,
    private readonly slackService: SlackService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 0 1 * *') // Run at midnight on the first day of every month
  async sendMonthlyLeaderboard() {
    if (!this.configService.showMonthlyLeader) {
      return;
    }

    try {
      const leaderboard = await this.burritosService.getLeaderboard();
      const formattedLeaderboard = leaderboard
        .map((user, index) =>
          this.i18nService.translate('leaderboard.entry', {
            position: index + 1,
            userId: user.slackId,
            count: user.burritosReceived,
          }),
        )
        .join('\n');

      const message = `${this.i18nService.translate('leaderboard.monthly_title')}\n${formattedLeaderboard}`;

      // Post to the default channel
      await this.slackService.postMessage({
        text: message,
        channel: this.configService.slackDefaultChannel,
      });
    } catch (error) {
      console.error('Failed to send monthly leaderboard:', error);
    }
  }
}
