import { Injectable } from '@nestjs/common';
import { SlackEventHandler, SlackEventContext } from './event.interface';

@Injectable()
export class UrlVerificationHandler implements SlackEventHandler {
  canHandle(type: string): boolean {
    return type === 'url_verification';
  }

  async execute(context: SlackEventContext): Promise<void> {
    context.response.send({ challenge: context.challenge });
  }
}
