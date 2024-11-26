import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SlackAuthMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction) {
    try {
      const slackSignature = req.headers['x-slack-signature'] as string;
      const slackTimestamp = req.headers['x-slack-request-timestamp'] as string;
      const signingSecret = process.env.SLACK_SIGNING_SECRET;

      if (!slackSignature || !slackTimestamp || !signingSecret) {
        throw new UnauthorizedException('Missing Slack headers or secret');
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(
        currentTime - parseInt(slackTimestamp, 10),
      );
      if (timeDifference > 300) {
        console.error('La solicitud ha expirado');
        throw new UnauthorizedException('Request timestamp expired');
      }

      const requestBody =
        req.body instanceof Buffer ? req.body.toString('utf8') : '';
      const baseString = `v0:${slackTimestamp}:${requestBody}`;

      const hmac = crypto
        .createHmac('sha256', signingSecret)
        .update(baseString)
        .digest('hex');
      const calculatedSignature = `v0=${hmac}`;

      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculatedSignature),
        Buffer.from(slackSignature),
      );

      if (!isValid) {
        console.error(
          `Firma no válida: ${calculatedSignature} != ${slackSignature}`,
        );
        throw new UnauthorizedException('Invalid Slack signature');
      }

      console.log('Solicitud de Slack verificada correctamente');
      next();
    } catch (error) {
      console.error('Error en la verificación de la solicitud de Slack', error);
      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException('Slack request verification failed');
    }
  }
}
