import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import axios from 'axios';

const FALLBACK_GIF_URL =
  'https://media3.giphy.com/media/lfI3HytbkYq1q/giphy.gif?cid=fd33a07fcvt6eojpvvifokwhj2pplp6q7rqlsbyrdsnwwvaw&ep=v1_gifs_search&rid=giphy.gif&ct=g';

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

  /** Random Giphy result for `query`, falling back to a burrito gif. */
  async searchGif(query: string): Promise<string> {
    const giphyApiKey = process.env.GIPHY_API_KEY;
    const response = await axios.get(
      `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=25&offset=0&rating=g&lang=en&bundle=messaging_non_clips`,
    );

    const gifs = response.data.data;
    if (gifs.length > 0) {
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      return randomGif.images.original.url;
    }

    return FALLBACK_GIF_URL;
  }

  async getGif(isError: boolean): Promise<string> {
    return this.searchGif(isError ? 'sad-people' : 'burrito');
  }

  async postMessage({
    channel,
    text,
    thread_ts,
    isError = false,
    gifQuery,
    imageTitle = '¡Burrito! 🌯',
  }: {
    channel: string;
    text: string;
    thread_ts?: string;
    isError?: boolean;
    /** Overrides the default burrito/sad-people Giphy search. */
    gifQuery?: string;
    imageTitle?: string;
  }) {
    const gif = gifQuery
      ? await this.searchGif(gifQuery)
      : await this.getGif(isError);
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
            text: imageTitle,
          },
          block_id: 'image4',
          image_url: gif,
          alt_text: imageTitle,
        },
      ],
    });
  }
}
