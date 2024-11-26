import {
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('validate')
  async validateRequest(@Req() req: Request, @Res() res: Response) {
    const slackSignature = req.headers['x-slack-signature'] as string;
    const slackTimestamp = req.headers['x-slack-request-timestamp'] as string;
    const requestBody = JSON.stringify(req.body);

    const isValid = this.authService.validateSlackRequest(
      slackTimestamp,
      requestBody,
      slackSignature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid Slack signature');
    }

    return res.status(200).send('Valid request!');
  }
}
