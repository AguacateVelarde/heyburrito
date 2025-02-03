import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { BurritosModule } from '../burritos/burritos.module';
import { I18nModule } from 'src/i18n/i18n.module';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [BurritosModule, I18nModule, ConfigModule],
  controllers: [SlackController],
  providers: [SlackService],
})
export class SlackModule {}
