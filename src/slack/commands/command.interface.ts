import { Response } from 'express';

export interface SlackCommandContext {
  userId: string;
  text: string;
  command: string;
  response: Response;
}

export interface SlackCommand {
  execute(context: SlackCommandContext): Promise<void>;
  canHandle(command: string): boolean;
}
