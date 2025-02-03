import { Injectable } from '@nestjs/common';
import {
  SlackEventHandler,
  SlackEventContext,
  SlackEvent,
} from './event.interface';
import { SlackService } from '../slack.service';
import { BurritosService } from '../../burritos/burritos.service';
import { I18nService } from 'src/i18n/i18n.service';

@Injectable()
export class ReactionHandler implements SlackEventHandler {
  constructor(
    private readonly slackService: SlackService,
    private readonly burritosService: BurritosService,
    private readonly i18nService: I18nService,
  ) {}

  canHandle(type: string, event?: SlackEvent): boolean {
    return (
      type === 'event_callback' &&
      event?.type === 'reaction_added' &&
      event.reaction === 'burrito'
    );
  }

  async execute(context: SlackEventContext): Promise<void> {
    const { user: giverId, item } = context.event;
    const { text } = await this.slackService.getMessage(item.channel, item.ts);

    const receiverId = text.match(/<@(\w+)>/)?.[1];

    try {
      await this.burritosService.giveBurrito({ giverId, receiverId });

      await this.slackService.postMessage({
        channel: item.channel,
        text: this.i18nService.translate('burrito.givenInChannel', {
          giverId,
          receiverId,
        }),
        thread_ts: item.ts,
      });
    } catch (error) {
      await this.slackService.postMessage({
        channel: item.channel,
        text: `${error.message} <@${giverId}>`,
        thread_ts: item.ts,
        isError: true,
      });
    }

    context.response.status(200).send();
  }
}
