import { Module } from '@nestjs/common';
import { BurritosService } from './burritos.service';
import { BurritosController } from './burritos.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Burrito, BurritoSchema } from './schemas/burrito.schema';
import { UsersModule } from '../users/users.module';

@Module({
  providers: [BurritosService],
  controllers: [BurritosController],
  exports: [BurritosService],
  imports: [
    MongooseModule.forFeature([{ name: Burrito.name, schema: BurritoSchema }]),
    UsersModule,
  ],
})
export class BurritosModule {}
