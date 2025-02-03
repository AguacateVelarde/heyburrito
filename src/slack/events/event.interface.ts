import { Response } from 'express';

export interface SlackEvent {
  type: string;
  [key: string]: any;
}

export interface SlackEventContext {
  event?: SlackEvent;
  type?: string;
  challenge?: string;
  response: Response;
}

export interface SlackEventHandler {
  canHandle(type: string, event?: SlackEvent): boolean;
  execute(context: SlackEventContext): Promise<void>;
}
