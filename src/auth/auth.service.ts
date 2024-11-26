import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  /**
   * Validate request using SLACK_SIGNING_SECRET.
   * @param timestamp Request timestamp.
   * @param body Body of the request in string.
   * @param signature Signature sent by Slack.
   */
  validateSlackRequest(
    timestamp: string,
    body: string,
    signature: string,
  ): boolean {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    // Building the base string
    const baseString = `v0:${timestamp}:${body}`;

    // Calculating the signature
    const hmac = crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex');
    const calculatedSignature = `v0=${hmac}`;

    // Compare the signatures
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature),
    );
  }
}
