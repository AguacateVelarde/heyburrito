import { Module } from '@nestjs/common';
import { BurritosService } from './burritos.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Burrito, BurritoSchema } from './schemas/burrito.schema';
import { UsersModule } from '../users/users.module';
import { ConfigModule } from '../config/config.module';
import { I18nModule } from 'src/i18n/i18n.module';

@Module({
  providers: [BurritosService],
  controllers: [],
  exports: [BurritosService],
  imports: [
    MongooseModule.forFeature([{ name: Burrito.name, schema: BurritoSchema }]),
    UsersModule,
    ConfigModule,
    I18nModule,
  ],
})
export class BurritosModule {}
