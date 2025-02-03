import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { BurritoCommand } from './commands/burrito.command';
import { LeaderboardCommand } from './commands/leaderboard.command';
import { UrlVerificationHandler } from './events/url-verification.handler';
import { ReactionHandler } from './events/reaction.handler';
import { MessageHandler } from './events/message.handler';
import { BurritosService } from 'src/burritos/burritos.service';
import { SlackService } from './slack.service';
import { I18nService } from '../i18n/i18n.service';
import { ConfigService } from 'src/config/config.service';

@Controller('slack')
export class SlackController {
  private commands: any[];
  private eventHandlers: any[];

  constructor(
    private readonly burritoService: BurritosService,
    private readonly slackService: SlackService,
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
  ) {
    this.commands = [
      new BurritoCommand(this.burritoService, this.i18nService),
      new LeaderboardCommand(
        this.burritoService,
        this.i18nService,
        this.configService,
      ),
    ];
    this.eventHandlers = [
      new UrlVerificationHandler(),
      new ReactionHandler(
        this.slackService,
        this.burritoService,
        this.i18nService,
      ),
      new MessageHandler(
        this.slackService,
        this.burritoService,
        this.i18nService,
      ),
    ];
  }

  @Post('commands')
  async handleCommand(@Req() req: Request, @Res() res: Response) {
    const { command, text, user_id } = req.body;

    const commandHandler = this.commands.find((cmd) => cmd.canHandle(command));
    if (!commandHandler) {
      return res
        .status(400)
        .send(this.i18nService.translate('errors.unknownCommand'));
    }

    await commandHandler.execute({
      userId: user_id,
      text,
      command,
      response: res,
    });
  }

  @Post('events')
  async handleEvents(@Req() req: Request, @Res() res: Response) {
    const { type, challenge, event } = req.body;

    const eventHandler = this.eventHandlers.find((handler) =>
      handler.canHandle(type, event),
    );
    if (!eventHandler) {
      return res
        .status(400)
        .send(this.i18nService.translate('errors.unknownEvent'));
    }

    await eventHandler.execute({
      type,
      event,
      challenge,
      response: res,
    });
  }
}
