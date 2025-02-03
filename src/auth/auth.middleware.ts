import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SlackAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SlackAuthMiddleware.name);

  use(req: Request, _: Response, next: NextFunction) {
    try {
      const slackSignature = req.headers['x-slack-signature'] as string;
      const slackTimestamp = req.headers['x-slack-request-timestamp'] as string;
      const signingSecret = process.env.SLACK_SIGNING_SECRET;

      this.logger.debug(
        `Validating request with signature: ${slackSignature?.slice(0, 10)}...`,
      );

      if (!slackSignature || !slackTimestamp || !signingSecret) {
        this.logger.warn('Missing required Slack headers or signing secret');
        throw new UnauthorizedException('Missing Slack headers or secret');
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(
        currentTime - parseInt(slackTimestamp, 10),
      );

      if (isNaN(parseInt(slackTimestamp, 10))) {
        this.logger.warn(`Invalid timestamp format: ${slackTimestamp}`);
        throw new UnauthorizedException('Invalid timestamp format');
      }

      if (timeDifference > 300) {
        this.logger.warn(
          `Request expired. Time difference: ${timeDifference}s`,
        );
        throw new UnauthorizedException('Request timestamp expired');
      }

      let requestBody = '';
      if (req.body instanceof Buffer) {
        requestBody = req.body.toString('utf8');
      } else if (typeof req.body === 'string') {
        requestBody = req.body;
      } else if (req.body) {
        requestBody = JSON.stringify(req.body);
      }

      if (!requestBody) {
        this.logger.warn('Empty request body');
        throw new UnauthorizedException('Empty request body');
      }

      const baseString = `v0:${slackTimestamp}:${requestBody}`;
      this.logger.debug(`Generated base string: ${baseString.slice(0, 50)}...`);

      const hmac = crypto
        .createHmac('sha256', signingSecret)
        .update(baseString)
        .digest('hex');
      const calculatedSignature = `v0=${hmac}`;

      let isValid = false;
      try {
        isValid = crypto.timingSafeEqual(
          Buffer.from(calculatedSignature),
          Buffer.from(slackSignature),
        );
      } catch (e) {
        this.logger.error('Error comparing signatures', e);
        throw new UnauthorizedException('Invalid signature format');
      }

      if (!isValid) {
        this.logger.warn('Invalid Slack signature');
        throw new UnauthorizedException('Invalid Slack signature');
      }

      this.logger.debug('Request validation successful');
      next();
    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException('Slack request verification failed');
    }
  }
}
