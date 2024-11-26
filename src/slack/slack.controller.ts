import { Controller, Post, Req, Res } from '@nestjs/common';
import { BurritosService } from '../burritos/burritos.service';
import { Request, Response } from 'express';
import { SlackService } from './slack.service';

@Controller('slack')
export class SlackController {
  constructor(
    private burritosService: BurritosService,
    private readonly slackService: SlackService,
  ) {}

  /**
   * This method handles Slack commands.
   * @param req
   * @param res
   * @returns Schema for Slack response.
   */
  @Post('commands')
  async handleCommand(@Req() req: Request, @Res() res: Response) {
    const { command, text, user_id } = req.body;

    if (command === '/leaderboard') {
      const leaderboard = await this.burritosService.getLeaderboard();

      // Formatting the leaderboard for Slack
      const formattedLeaderboard = leaderboard
        .map(
          (user, index) =>
            `${index + 1}. *<@${user.slackId}>*: ${user.burritosReceived} burritos 🌯`,
        )
        .join('\n');

      return res.json({
        response_type: 'in_channel',
        text: `🏆 *Leaderboard de Burritos* 🏆\n${formattedLeaderboard}`,
      });
    }

    if (command === '/burrito') {
      console.log(`Comando recibido: ${text}`);
      console.log(JSON.stringify(req.body, null, 4));
      const [mention, ...messageParts] = text.split(' ');
      const message = messageParts.join(' ');
      const receiverId = mention.replace(/[<@>]/g, ''); // Extracting the user ID from the mention

      try {
        await this.burritosService.giveBurrito(user_id, receiverId, message);
        return res.json({
          text: `¡Burrito enviado a <@${receiverId}>! 🌯 ${message ? `\n"${message}"` : ''}`,
          response_type: 'in_channel',
        });
      } catch (error) {
        return res.json({ text: `Error: ${error.message}` });
      }
    }

    return res.status(400).send('Comando no reconocido.');
  }

  /**
   * Maneja eventos de Slack (opcional).
   * Endpoint: /slack/events
   */
  @Post('events')
  async handleEvents(@Req() req: Request, @Res() res: Response) {
    const { type, challenge, event } = req.body;

    console.log(JSON.stringify(req.body, null, 4));

    if (type === 'url_verification') {
      return res.send({ challenge });
    }

    if (event && event.type === 'reaction_added') {
      const { reaction, item, user: giverId, item_user: receiverId } = event;

      if (reaction === 'burrito') {
        await this.burritosService.giveBurrito(giverId, receiverId);
        await this.slackService.postMessage({
          channel: item.channel,
          text: `¡<@${giverId}> le dio un burrito a <@${receiverId}>! 🌯`,
          thread_ts: item.ts,
        });
      }
    }

    if (event && event.type === 'message') {
      const { text, user: giverId, channel } = event;

      if (text.includes(':burrito:')) {
        const receiverId = text.match(/<@(\w+)>/)?.[1];
        await this.burritosService.giveBurrito(giverId, receiverId);
        await this.slackService.postMessage({
          channel,
          text: `¡<@${giverId}> le dio un burrito a <@${receiverId} 🌯`,
          thread_ts: event.ts,
        });
      }
    }

    res.status(200).send();
  }
}
