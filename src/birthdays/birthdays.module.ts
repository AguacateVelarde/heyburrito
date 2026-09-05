import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BirthdaysService } from './birthdays.service';
import { Birthday, BirthdaySchema } from './schemas/birthday.schema';
import { I18nModule } from '../i18n/i18n.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Birthday.name, schema: BirthdaySchema },
    ]),
    I18nModule,
    ConfigModule,
  ],
  providers: [BirthdaysService],
  exports: [BirthdaysService],
})
export class BirthdaysModule {}
