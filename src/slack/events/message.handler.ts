import { Injectable } from '@nestjs/common';
import {
  SlackEventHandler,
  SlackEventContext,
  SlackEvent,
} from './event.interface';
import { SlackService } from '../slack.service';
import { BurritosService } from '../../burritos/burritos.service';
import { I18nService } from '../../i18n/i18n.service';

export const SYSTEM_USER_ID = 'SYSTEM';

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
    const mentions = [
      ...new Set([...text.matchAll(/<@(\w+)>/g)].map((m) => m[1])),
    ];

    if (mentions.length === 0) {
      try {
        await this.burritosService.giveBurrito({
          giverId: SYSTEM_USER_ID,
          receiverId: giverId,
        });
        await this.slackService.postMessage({
          channel,
          text: this.i18nService.translate('burrito.selfGiven', {
            receiverId: giverId,
          }),
          thread_ts: ts,
        });
      } catch (error) {
        await this.handlerError(`${error.message} <@${giverId}>`, channel, ts);
      }
    } else {
      const successes: string[] = [];

      for (const receiverId of mentions) {
        try {
          await this.burritosService.giveBurrito({ giverId, receiverId });
          successes.push(receiverId);
        } catch (error) {
          await this.handlerError(
            `${error.message} → <@${receiverId}> <@${giverId}>`,
            channel,
            ts,
          );
        }
      }

      if (successes.length > 0) {
        const receiversText = successes.map((id) => `<@${id}>`).join(', ');
        const messageText =
          successes.length === 1
            ? this.i18nService.translate('burrito.givenInChannel', {
                giverId,
                receiverId: successes[0],
              })
            : this.i18nService.translate('burrito.givenMultiple', {
                giverId,
                receivers: receiversText,
                count: successes.length,
              });

        await this.slackService.postMessage({
          channel,
          text: messageText,
          thread_ts: ts,
        });
      }
    }

    context.response.status(200).send(`Message Handler executed successfull`);
  }
}
