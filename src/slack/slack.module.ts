import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { BurritosModule } from '../burritos/burritos.module';
import { I18nModule } from 'src/i18n/i18n.module';
import { ConfigModule } from 'src/config/config.module';
import { BirthdaysModule } from '../birthdays/birthdays.module';
import { BirthdayAnnouncerService } from './birthday-announcer.service';

@Module({
  imports: [BurritosModule, I18nModule, ConfigModule, BirthdaysModule],
  controllers: [SlackController],
  providers: [SlackService, BirthdayAnnouncerService],
  exports: [SlackService, BirthdayAnnouncerService],
})
export class SlackModule {}
