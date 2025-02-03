import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import axios from 'axios';

@Injectable()
export class SlackService {
  private client: WebClient;

  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  async sendMessage(channel: string, text: string) {
    await this.client.chat.postMessage({ channel, text });
  }

  async getMessage(channel: string, ts: string) {
    const result = await this.client.conversations.history({
      channel,
      latest: ts,
      inclusive: true,
      limit: 1,
    });
    return result.messages[0];
  }

  async getUserInfo(userId: string) {
    const result = await this.client.users.info({ user: userId });
    return result.user;
  }

  async getGif(isError: boolean): Promise<string> {
    const giphyApiKey = process.env.GIPHY_API_KEY;
    const response = await axios.get(
      `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${isError ? 'sad-people' : 'burrito'}&limit=25&offset=0&rating=g&lang=en&bundle=messaging_non_clips`,
    );

    const gifs = response.data.data;
    if (gifs.length > 0) {
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      return randomGif.images.original.url;
    }

    return 'https://media3.giphy.com/media/lfI3HytbkYq1q/giphy.gif?cid=fd33a07fcvt6eojpvvifokwhj2pplp6q7rqlsbyrdsnwwvaw&ep=v1_gifs_search&rid=giphy.gif&ct=g';
  }

  async postMessage({
    channel,
    text,
    thread_ts,
    isError = false,
  }: {
    channel: string;
    text: string;
    thread_ts?: string;
    isError?: boolean;
  }) {
    const burritoGif = await this.getGif(isError);
    return this.client.chat.postMessage({
      channel,
      text,
      thread_ts,
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
