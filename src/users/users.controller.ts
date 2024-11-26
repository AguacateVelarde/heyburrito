import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Endpoint para obtener todos los usuarios.
   * GET /users
   */
  @Get()
  async getAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * Endpoint para obtener un usuario por su Slack ID.
   * GET /users/:slackId
   */
  @Get(':slackId')
  async getUserBySlackId(@Param('slackId') slackId: string) {
    const user = await this.usersService.findBySlackId(slackId);
    if (!user) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  /**
   * Endpoint para actualizar las estadísticas de un usuario.
   * PATCH /users/:slackId
   * Body: { field: 'burritosGiven' | 'burritosReceived' }
   */
  @Patch(':slackId')
  async updateUserStats(
    @Param('slackId') slackId: string,
    @Body() body: { field: 'burritosGiven' | 'burritosReceived' },
  ) {
    const { field } = body;
    if (!['burritosGiven', 'burritosReceived'].includes(field)) {
      throw new HttpException('Campo inválido', HttpStatus.BAD_REQUEST);
    }

    const user = await this.usersService.findBySlackId(slackId);

    const updatedUser = await this.usersService.updateStats(user, field);
    if (!updatedUser) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    return updatedUser;
  }
}
