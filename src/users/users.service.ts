import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findBySlackId(slackId: string): Promise<User | null> {
    return this.userModel.findOne({ slackId }).exec();
  }

  async findOrCreate(slackId: string): Promise<User> {
    let user = await this.userModel.findOne({ slackId }).exec();
    if (!user) {
      user = new this.userModel({ slackId });
      await user.save();
      console.log(`Usuario creado: (${slackId})`);
    }
    return user;
  }

  async updateStats(
    user: User,
    field: 'burritosGiven' | 'burritosReceived',
  ): Promise<User> {
    return this.userModel
      .findOneAndUpdate(
        { slackId: user.slackId },
        { $inc: { [field]: 1 } },
        { new: true },
      )
      .exec();
  }

  async getLeaderboard(): Promise<User[]> {
    return this.userModel
      .find()
      .sort({ burritosReceived: -1 })
      .limit(10)
      .exec();
  }

  async getTopGivers(limit: number) {
    return this.userModel
      .find()
      .sort({ burritosGiven: -1 })
      .limit(limit)
      .exec();
  }
}
