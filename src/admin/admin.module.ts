import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BurritosModule } from '../burritos/burritos.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { BirthdaysModule } from '../birthdays/birthdays.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [
    BurritosModule,
    UsersModule,
    AuthModule,
    BirthdaysModule,
    SlackModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
