import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';

@Injectable()
export class SlackService {
  private client: WebClient;

  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  /**
   * Envía un mensaje a un canal o usuario en Slack.
   * @param channel Canal o usuario al que enviar el mensaje.
   * @param text Texto del mensaje.
   */
  async sendMessage(channel: string, text: string) {
    await this.client.chat.postMessage({ channel, text });
  }

  /**
   * Obtiene información sobre un usuario de Slack.
   * @param userId ID del usuario en Slack.
   */
  async getUserInfo(userId: string) {
    const result = await this.client.users.info({ user: userId });
    return result.user;
  }
  async postMessage({
    channel,
    text,
    thread_ts,
  }: {
    channel: string;
    text: string;
    thread_ts?: string;
  }) {
    return this.client.chat.postMessage({
      channel,
      text,
      thread_ts, // Si se incluye, el mensaje será una respuesta en el hilo
    });
  }
}
