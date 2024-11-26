import { Controller, Post, Body, Get } from '@nestjs/common';
import { BurritosService } from './burritos.service';

@Controller('burritos')
export class BurritosController {
  constructor(private burritosService: BurritosService) {}

  /**
   * Give a burrito to a user, with an optional message.
   * @returns Document of the burrito given with mongo _id.
   */
  @Post('give')
  async giveBurrito(@Body() request: any) {
    const { giverId, receiverId, message } = request;
    return this.burritosService.giveBurrito(giverId, receiverId, message);
  }

  /**
   * Only for testing purposes.
   * @returns Leaderboard of burritos given.
   */
  @Get('leaderboard')
  async getLeaderboard() {
    return this.burritosService.getLeaderboard();
  }
}
