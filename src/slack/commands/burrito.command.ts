import { Injectable } from '@nestjs/common';
import { BurritosService } from '../../burritos/burritos.service';
import { SlackCommand, SlackCommandContext } from './command.interface';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class BurritoCommand implements SlackCommand {
  constructor(
    private readonly burritosService: BurritosService,
    private readonly i18nService: I18nService,
  ) {}

  canHandle(command: string): boolean {
    return command === '/burrito';
  }

  async execute(context: SlackCommandContext): Promise<void> {
    const [mention, ...messageParts] = context.text.split(' ');
    const message = messageParts.join(' ');
    const receiverId = mention.replace(/[<@>]/g, '');
    try {
      await this.burritosService.giveBurrito({
        giverId: context.userId,
        receiverId,
        message,
      });
      context.response.json({
        text: this.i18nService.translate(
          message ? 'burrito.givenWithMessage' : 'burrito.given',
          {
            giverId: context.userId,
            receiverId,
            message,
          },
        ),
        response_type: 'in_channel',
      });
    } catch (error) {
      context.response.json({
        text: this.i18nService.translate('burrito.error', {
          message: error.message,
        }),
      });
    }
  }
}
