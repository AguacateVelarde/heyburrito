import { Injectable } from '@nestjs/common';
import { BurritosService } from '../../burritos/burritos.service';
import { SlackCommand, SlackCommandContext } from './command.interface';
import { I18nService } from '../../i18n/i18n.service';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class LeaderboardCommand implements SlackCommand {
  constructor(
    private readonly burritosService: BurritosService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
  ) {}

  canHandle(command: string): boolean {
    return command === '/leaderboard';
  }

  async execute(context: SlackCommandContext): Promise<void> {
    if (!this.configService.isLeaderboardEnabled) {
      context.response.json({
        text: this.i18nService.translate('leaderboard.disabled'),
        response_type: 'ephemeral',
      });
      return;
    }

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

    context.response.json({
      response_type: 'in_channel',
      text: `${this.i18nService.translate('leaderboard.title')}\n${formattedLeaderboard}`,
    });
  }
}
