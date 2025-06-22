import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { BurritosModule } from './burritos/burritos.module';
import { SlackModule } from './slack/slack.module';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './config.validation';
import { I18nModule } from './i18n/i18n.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    UsersModule,
    BurritosModule,
    SlackModule,
    I18nModule,
    ConfigModule,
    AdminModule,
    AuthModule,
  ],
})
export class AppModule {}
