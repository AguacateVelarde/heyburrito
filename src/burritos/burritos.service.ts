import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Burrito } from './schemas/burrito.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class BurritosService {
  constructor(
    @InjectModel(Burrito.name) private burritoModel: Model<Burrito>,
    private usersService: UsersService,
  ) {}

  async giveBurrito(giverId: string, receiverId: string, message?: string) {
    if (giverId === receiverId) {
      throw new UnprocessableEntityException({
        message: 'You cannot give a burrito to yourself',
      });
    }

    const burrito = await this.burritoModel.create({
      giverId,
      receiverId,
      message,
    });

    const giver = await this.usersService.findOrCreate(giverId);
    const receiver = await this.usersService.findOrCreate(receiverId);

    await this.usersService.updateStats(giver, 'burritosGiven');
    await this.usersService.updateStats(receiver, 'burritosReceived');
    return burrito;
  }

  async getLeaderboard() {
    return this.usersService.getLeaderboard();
  }
}
