import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Burrito extends Document {
  @Prop({ required: true })
  giverId: string;

  @Prop({ required: true })
  receiverId: string;

  @Prop()
  message: string;
}

export const BurritoSchema = SchemaFactory.createForClass(Burrito);
