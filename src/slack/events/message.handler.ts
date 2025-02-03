import { Injectable } from '@nestjs/common';
import {
  SlackEventHandler,
  SlackEventContext,
  SlackEvent,
} from './event.interface';
import { SlackService } from '../slack.service';
import { BurritosService } from '../../burritos/burritos.service';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class MessageHandler implements SlackEventHandler {
  constructor(
    private readonly slackService: SlackService,
    private readonly burritosService: BurritosService,
    private readonly i18nService: I18nService,
  ) {}

  private async handlerError(
    message: string,
    channel: string,
    thread_ts: string,
  ) {
    await this.slackService.postMessage({
      channel,
      text: message,
      thread_ts,
      isError: true,
    });
  }

  canHandle(type: string, event?: SlackEvent): boolean {
    return (
      type === 'event_callback' &&
      event?.type === 'message' &&
      !event.bot_id &&
      event.text?.includes(':burrito:')
    );
  }

  async execute(context: SlackEventContext): Promise<void> {
    const { text, user: giverId, channel, ts } = context.event;
    const receiverId = text.match(/<@(\w+)>/)?.[1];

    if (receiverId) {
      try {
        await this.burritosService.giveBurrito({
          giverId,
          receiverId,
        });
        await this.slackService.postMessage({
          channel,
          text: this.i18nService.translate('burrito.givenInChannel', {
            giverId,
            receiverId,
          }),
          thread_ts: ts,
        });
      } catch (error) {
        await this.handlerError(`${error.message} <@${giverId}>`, channel, ts);
      }
    }
    context.response.status(200).send(`Message Handler executed successfull`);
  }
}
