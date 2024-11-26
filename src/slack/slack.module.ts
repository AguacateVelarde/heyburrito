import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { BurritosModule } from '../burritos/burritos.module';

@Module({
  imports: [BurritosModule], // Importa el módulo de burritos para usar su servicio
  controllers: [SlackController],
  providers: [SlackService],
})
export class SlackModule {}
