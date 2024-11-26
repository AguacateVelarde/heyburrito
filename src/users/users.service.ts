import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  // Encuentra todos los usuarios
  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  // Encuentra un usuario por Slack ID
  async findBySlackId(slackId: string): Promise<User | null> {
    return this.userModel.findOne({ slackId }).exec();
  }

  /**
   * Busca un usuario por su Slack ID, o lo crea si no existe.
   * @param slackId ID del usuario en Slack.
   * @param name Nombre del usuario.
   */
  async findOrCreate(slackId: string): Promise<User> {
    let user = await this.userModel.findOne({ slackId }).exec();
    if (!user) {
      user = new this.userModel({ slackId });
      await user.save();
      console.log(`Usuario creado: (${slackId})`);
    }
    return user;
  }

  /**
   * Actualiza las estadísticas de burritos dados o recibidos.
   * @param slackId ID del usuario en Slack.
   * @param field Campo a actualizar (`burritosGiven` o `burritosReceived`).
   */
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

  /**
   * Obtiene el leaderboard de los usuarios basado en burritos recibidos.
   * @returns Lista de usuarios ordenados por burritos recibidos.
   */
  async getLeaderboard(): Promise<User[]> {
    return this.userModel
      .find()
      .sort({ burritosReceived: -1 })
      .limit(10)
      .exec();
  }
}
