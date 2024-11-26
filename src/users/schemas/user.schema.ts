import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ required: true, unique: true })
  slackId: string;

  @Prop({ required: false })
  name: string;

  @Prop({ default: 0 })
  burritosReceived: number;

  @Prop({ default: 0 })
  burritosGiven: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
