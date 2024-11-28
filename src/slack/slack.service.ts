import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import axios from 'axios';

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

  // Método para buscar un GIF de Giphy
  async getBurritoGif(): Promise<string> {
    const giphyApiKey = process.env.GIPHY_API_KEY;
    console.log(
      `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=burrito&limit=25&offset=0&rating=g&lang=en&bundle=messaging_non_clips`,
    );
    const response = await axios.get(
      `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=burrito&limit=25&offset=0&rating=g&lang=en&bundle=messaging_non_clips`,
    );

    const gifs = response.data.data;
    if (gifs.length > 0) {
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      return randomGif.images.original.url; // URL del GIF
    }

    // En caso de que no haya resultados, usa una URL por defecto
    return 'https://media3.giphy.com/media/lfI3HytbkYq1q/giphy.gif?cid=fd33a07fcvt6eojpvvifokwhj2pplp6q7rqlsbyrdsnwwvaw&ep=v1_gifs_search&rid=giphy.gif&ct=g';
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
    const burritoGif = await this.getBurritoGif();
    return this.client.chat.postMessage({
      channel,
      text,
      thread_ts, // Si se incluye, el mensaje será una respuesta en el hilo
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text,
          },
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: `¡Burrito! 🌯`,
          },
          block_id: 'image4',
          image_url: burritoGif,
          alt_text: 'Photo of a burrito',
        },
      ],
    });
  }
}
